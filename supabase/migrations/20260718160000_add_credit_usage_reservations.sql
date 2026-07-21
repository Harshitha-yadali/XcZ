CREATE TABLE IF NOT EXISTS public.credit_usage_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_key text NOT NULL,
  credit_type text NOT NULL CHECK (credit_type IN ('optimization', 'score_check')),
  optimization_tier text CHECK (optimization_tier IS NULL OR optimization_tier IN ('quick', 'smart', 'deep')),
  quantity integer NOT NULL CHECK (quantity > 0),
  allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'finalized', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  refunded_at timestamptz,
  UNIQUE (user_id, request_key)
);

ALTER TABLE public.credit_usage_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own credit reservations" ON public.credit_usage_reservations;
CREATE POLICY "Users read own credit reservations"
  ON public.credit_usage_reservations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.reserve_user_credit(
  p_request_key text,
  p_credit_type text,
  p_quantity integer DEFAULT 1,
  p_optimization_tier text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tier text := CASE WHEN p_credit_type = 'optimization' THEN COALESCE(p_optimization_tier, 'quick') ELSE NULL END;
  v_existing public.credit_usage_reservations%ROWTYPE;
  v_remaining_to_allocate integer := p_quantity;
  v_take integer;
  v_allocations jsonb := '[]'::jsonb;
  v_addon record;
  v_subscription record;
  v_consume jsonb;
  v_reservation_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_request_key IS NULL OR length(trim(p_request_key)) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid request key.');
  END IF;
  IF p_credit_type NOT IN ('optimization', 'score_check') OR p_quantity < 1 OR p_quantity > 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid reservation request.');
  END IF;
  IF p_credit_type = 'optimization' AND v_tier NOT IN ('quick', 'smart', 'deep') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid optimization tier.');
  END IF;

  -- Serialize retries carrying the same idempotency key. This prevents two
  -- concurrent browser requests from reserving the same action twice.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_request_key, 0));

  SELECT * INTO v_existing
  FROM public.credit_usage_reservations
  WHERE user_id = v_user_id AND request_key = p_request_key
  FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', v_existing.status IN ('reserved', 'finalized'),
      'reservation_id', v_existing.id,
      'status', v_existing.status,
      'error', CASE WHEN v_existing.status = 'refunded' THEN 'This request was already refunded.' ELSE NULL END
    );
  END IF;

  FOR v_addon IN
    SELECT credits.id, COALESCE(credits.quantity_remaining, 0)::integer AS available
    FROM public.user_addon_credits credits
    JOIN public.addon_types types ON types.id = credits.addon_type_id
    WHERE credits.user_id = v_user_id
      AND types.type_key = p_credit_type
      AND (p_credit_type <> 'optimization' OR COALESCE(credits.optimization_tier, 'quick') = v_tier)
      AND COALESCE(credits.quantity_remaining, 0) > 0
    ORDER BY credits.purchased_at, credits.id
    FOR UPDATE OF credits
  LOOP
    EXIT WHEN v_remaining_to_allocate = 0;
    v_take := LEAST(v_remaining_to_allocate, v_addon.available);
    v_allocations := v_allocations || jsonb_build_array(jsonb_build_object('source', 'addon', 'id', v_addon.id, 'quantity', v_take));
    v_remaining_to_allocate := v_remaining_to_allocate - v_take;
  END LOOP;

  FOR v_subscription IN
    SELECT subscriptions.id,
      CASE
        WHEN p_credit_type = 'optimization' AND v_tier = 'quick' THEN COALESCE(quick_optimizations_total, 0) - COALESCE(quick_optimizations_used, 0)
        WHEN p_credit_type = 'optimization' AND v_tier = 'smart' THEN COALESCE(smart_optimizations_total, 0) - COALESCE(smart_optimizations_used, 0)
        WHEN p_credit_type = 'optimization' AND v_tier = 'deep' THEN COALESCE(deep_optimizations_total, 0) - COALESCE(deep_optimizations_used, 0)
        WHEN p_credit_type = 'score_check' THEN COALESCE(score_checks_total, 0) - COALESCE(score_checks_used, 0)
      END::integer AS available
    FROM public.subscriptions subscriptions
    WHERE subscriptions.user_id = v_user_id AND subscriptions.status = 'active'
    ORDER BY subscriptions.created_at, subscriptions.id
    FOR UPDATE OF subscriptions
  LOOP
    EXIT WHEN v_remaining_to_allocate = 0;
    v_take := LEAST(v_remaining_to_allocate, GREATEST(0, v_subscription.available));
    CONTINUE WHEN v_take = 0;
    v_allocations := v_allocations || jsonb_build_array(jsonb_build_object('source', 'subscription', 'id', v_subscription.id, 'quantity', v_take));
    v_remaining_to_allocate := v_remaining_to_allocate - v_take;
  END LOOP;

  IF v_remaining_to_allocate <> 0 THEN
    RETURN jsonb_build_object('success', false, 'remaining', p_quantity - v_remaining_to_allocate, 'error', 'Insufficient credits.');
  END IF;

  v_consume := public.consume_user_credits(p_credit_type, p_quantity, v_tier);
  IF NOT COALESCE((v_consume->>'success')::boolean, false) THEN RETURN v_consume; END IF;

  INSERT INTO public.credit_usage_reservations(user_id, request_key, credit_type, optimization_tier, quantity, allocations)
  VALUES (v_user_id, p_request_key, p_credit_type, v_tier, p_quantity, v_allocations)
  RETURNING id INTO v_reservation_id;

  RETURN v_consume || jsonb_build_object('reservation_id', v_reservation_id, 'status', 'reserved');
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_user_credit_reservation(p_reservation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.credit_usage_reservations%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.credit_usage_reservations
  WHERE id = p_reservation_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Reservation not found.'); END IF;
  IF v_row.status = 'refunded' THEN RETURN jsonb_build_object('success', false, 'error', 'Reservation was refunded.'); END IF;
  UPDATE public.credit_usage_reservations SET status = 'finalized', finalized_at = COALESCE(finalized_at, now())
  WHERE id = v_row.id;
  RETURN jsonb_build_object('success', true, 'reservation_id', v_row.id, 'status', 'finalized');
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_user_credit_reservation(p_reservation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.credit_usage_reservations%ROWTYPE;
  v_allocation jsonb;
  v_id uuid;
  v_quantity integer;
BEGIN
  SELECT * INTO v_row FROM public.credit_usage_reservations
  WHERE id = p_reservation_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Reservation not found.'); END IF;
  IF v_row.status = 'finalized' THEN RETURN jsonb_build_object('success', false, 'error', 'Finalized usage cannot be refunded automatically.'); END IF;
  IF v_row.status = 'refunded' THEN RETURN jsonb_build_object('success', true, 'reservation_id', v_row.id, 'status', 'refunded'); END IF;

  FOR v_allocation IN SELECT value FROM jsonb_array_elements(v_row.allocations)
  LOOP
    v_id := (v_allocation->>'id')::uuid;
    v_quantity := (v_allocation->>'quantity')::integer;
    IF v_allocation->>'source' = 'addon' THEN
      UPDATE public.user_addon_credits SET quantity_remaining = quantity_remaining + v_quantity
      WHERE id = v_id AND user_id = auth.uid();
    ELSIF v_row.credit_type = 'score_check' THEN
      UPDATE public.subscriptions SET score_checks_used = GREATEST(0, score_checks_used - v_quantity), updated_at = now()
      WHERE id = v_id AND user_id = auth.uid();
    ELSIF v_row.optimization_tier = 'quick' THEN
      UPDATE public.subscriptions SET
        quick_optimizations_used = GREATEST(0, quick_optimizations_used - v_quantity),
        optimizations_used = GREATEST(0, optimizations_used - v_quantity), updated_at = now()
      WHERE id = v_id AND user_id = auth.uid();
    ELSIF v_row.optimization_tier = 'smart' THEN
      UPDATE public.subscriptions SET
        smart_optimizations_used = GREATEST(0, smart_optimizations_used - v_quantity),
        optimizations_used = GREATEST(0, optimizations_used - v_quantity), updated_at = now()
      WHERE id = v_id AND user_id = auth.uid();
    ELSIF v_row.optimization_tier = 'deep' THEN
      UPDATE public.subscriptions SET
        deep_optimizations_used = GREATEST(0, deep_optimizations_used - v_quantity),
        optimizations_used = GREATEST(0, optimizations_used - v_quantity), updated_at = now()
      WHERE id = v_id AND user_id = auth.uid();
    END IF;
  END LOOP;

  UPDATE public.credit_usage_reservations SET status = 'refunded', refunded_at = now() WHERE id = v_row.id;
  RETURN jsonb_build_object('success', true, 'reservation_id', v_row.id, 'status', 'refunded');
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_user_credit(text, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_user_credit_reservation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_user_credit_reservation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_user_credit(text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_user_credit_reservation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_user_credit_reservation(uuid) TO authenticated;
