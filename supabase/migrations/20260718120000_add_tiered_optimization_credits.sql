-- Split optimization credits into Quick, Smart, and Deep balances.
-- Every balance that exists when this migration runs becomes Quick Scan credit.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS quick_optimizations_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quick_optimizations_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS smart_optimizations_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS smart_optimizations_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deep_optimizations_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deep_optimizations_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.user_addon_credits
  ADD COLUMN IF NOT EXISTS optimization_tier text;

UPDATE public.subscriptions
SET
  quick_optimizations_total = GREATEST(0, COALESCE(optimizations_total, 0)),
  quick_optimizations_used = LEAST(
    GREATEST(0, COALESCE(optimizations_total, 0)),
    GREATEST(0, COALESCE(optimizations_used, 0))
  ),
  smart_optimizations_total = 0,
  smart_optimizations_used = 0,
  deep_optimizations_total = 0,
  deep_optimizations_used = 0;

UPDATE public.user_addon_credits AS credits
SET optimization_tier = 'quick'
FROM public.addon_types AS types
WHERE types.id = credits.addon_type_id
  AND types.type_key = 'optimization';

ALTER TABLE public.user_addon_credits
  DROP CONSTRAINT IF EXISTS user_addon_credits_optimization_tier_check;

ALTER TABLE public.user_addon_credits
  ADD CONSTRAINT user_addon_credits_optimization_tier_check
  CHECK (optimization_tier IS NULL OR optimization_tier IN ('quick', 'smart', 'deep'));

DROP FUNCTION IF EXISTS public.consume_user_credits(text, integer);

CREATE OR REPLACE FUNCTION public.consume_user_credits(
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
  v_tier text := CASE
    WHEN p_credit_type = 'optimization' THEN COALESCE(p_optimization_tier, 'quick')
    ELSE NULL
  END;
  v_available integer := 0;
  v_to_consume integer := p_quantity;
  v_take integer := 0;
  v_addon record;
  v_subscription record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 100 THEN
    RETURN jsonb_build_object('success', false, 'remaining', 0, 'error', 'Invalid credit quantity.');
  END IF;

  IF p_credit_type NOT IN ('optimization', 'score_check', 'linkedin_messages', 'guided_build') THEN
    RETURN jsonb_build_object('success', false, 'remaining', 0, 'error', 'Invalid credit type.');
  END IF;

  IF p_credit_type = 'optimization' AND v_tier NOT IN ('quick', 'smart', 'deep') THEN
    RETURN jsonb_build_object('success', false, 'remaining', 0, 'error', 'Invalid optimization tier.');
  END IF;

  FOR v_addon IN
    SELECT credits.id, GREATEST(0, COALESCE(credits.quantity_remaining, 0))::integer AS remaining
    FROM public.user_addon_credits AS credits
    JOIN public.addon_types AS types ON types.id = credits.addon_type_id
    WHERE credits.user_id = v_user_id
      AND types.type_key = p_credit_type
      AND (p_credit_type <> 'optimization' OR COALESCE(credits.optimization_tier, 'quick') = v_tier)
      AND COALESCE(credits.quantity_remaining, 0) > 0
    ORDER BY credits.purchased_at ASC, credits.id ASC
    FOR UPDATE OF credits
  LOOP
    v_available := v_available + v_addon.remaining;
  END LOOP;

  FOR v_subscription IN
    SELECT
      subscriptions.id,
      CASE
        WHEN p_credit_type = 'optimization' AND v_tier = 'quick' THEN COALESCE(subscriptions.quick_optimizations_total, 0)
        WHEN p_credit_type = 'optimization' AND v_tier = 'smart' THEN COALESCE(subscriptions.smart_optimizations_total, 0)
        WHEN p_credit_type = 'optimization' AND v_tier = 'deep' THEN COALESCE(subscriptions.deep_optimizations_total, 0)
        WHEN p_credit_type = 'score_check' THEN COALESCE(subscriptions.score_checks_total, 0)
        WHEN p_credit_type = 'linkedin_messages' THEN COALESCE(subscriptions.linkedin_messages_total, 0)
        WHEN p_credit_type = 'guided_build' THEN COALESCE(subscriptions.guided_builds_total, 0)
      END::integer AS total,
      CASE
        WHEN p_credit_type = 'optimization' AND v_tier = 'quick' THEN COALESCE(subscriptions.quick_optimizations_used, 0)
        WHEN p_credit_type = 'optimization' AND v_tier = 'smart' THEN COALESCE(subscriptions.smart_optimizations_used, 0)
        WHEN p_credit_type = 'optimization' AND v_tier = 'deep' THEN COALESCE(subscriptions.deep_optimizations_used, 0)
        WHEN p_credit_type = 'score_check' THEN COALESCE(subscriptions.score_checks_used, 0)
        WHEN p_credit_type = 'linkedin_messages' THEN COALESCE(subscriptions.linkedin_messages_used, 0)
        WHEN p_credit_type = 'guided_build' THEN COALESCE(subscriptions.guided_builds_used, 0)
      END::integer AS used
    FROM public.subscriptions AS subscriptions
    WHERE subscriptions.user_id = v_user_id
      AND subscriptions.status = 'active'
    ORDER BY subscriptions.created_at ASC, subscriptions.id ASC
    FOR UPDATE OF subscriptions
  LOOP
    v_available := v_available + GREATEST(0, v_subscription.total - v_subscription.used);
  END LOOP;

  IF v_available < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'remaining', v_available,
      'error', format(
        'This action requires %s %s credit%s, but only %s are available.',
        p_quantity,
        CASE WHEN p_credit_type = 'optimization' THEN initcap(v_tier) ELSE replace(p_credit_type, '_', ' ') END,
        CASE WHEN p_quantity = 1 THEN '' ELSE 's' END,
        v_available
      )
    );
  END IF;

  FOR v_addon IN
    SELECT credits.id, GREATEST(0, COALESCE(credits.quantity_remaining, 0))::integer AS remaining
    FROM public.user_addon_credits AS credits
    JOIN public.addon_types AS types ON types.id = credits.addon_type_id
    WHERE credits.user_id = v_user_id
      AND types.type_key = p_credit_type
      AND (p_credit_type <> 'optimization' OR COALESCE(credits.optimization_tier, 'quick') = v_tier)
      AND COALESCE(credits.quantity_remaining, 0) > 0
    ORDER BY credits.purchased_at ASC, credits.id ASC
  LOOP
    EXIT WHEN v_to_consume = 0;
    v_take := LEAST(v_to_consume, v_addon.remaining);
    UPDATE public.user_addon_credits
    SET quantity_remaining = quantity_remaining - v_take
    WHERE id = v_addon.id AND user_id = v_user_id;
    v_to_consume := v_to_consume - v_take;
  END LOOP;

  FOR v_subscription IN
    SELECT
      subscriptions.id,
      CASE
        WHEN p_credit_type = 'optimization' AND v_tier = 'quick' THEN COALESCE(subscriptions.quick_optimizations_total, 0)
        WHEN p_credit_type = 'optimization' AND v_tier = 'smart' THEN COALESCE(subscriptions.smart_optimizations_total, 0)
        WHEN p_credit_type = 'optimization' AND v_tier = 'deep' THEN COALESCE(subscriptions.deep_optimizations_total, 0)
        WHEN p_credit_type = 'score_check' THEN COALESCE(subscriptions.score_checks_total, 0)
        WHEN p_credit_type = 'linkedin_messages' THEN COALESCE(subscriptions.linkedin_messages_total, 0)
        WHEN p_credit_type = 'guided_build' THEN COALESCE(subscriptions.guided_builds_total, 0)
      END::integer AS total,
      CASE
        WHEN p_credit_type = 'optimization' AND v_tier = 'quick' THEN COALESCE(subscriptions.quick_optimizations_used, 0)
        WHEN p_credit_type = 'optimization' AND v_tier = 'smart' THEN COALESCE(subscriptions.smart_optimizations_used, 0)
        WHEN p_credit_type = 'optimization' AND v_tier = 'deep' THEN COALESCE(subscriptions.deep_optimizations_used, 0)
        WHEN p_credit_type = 'score_check' THEN COALESCE(subscriptions.score_checks_used, 0)
        WHEN p_credit_type = 'linkedin_messages' THEN COALESCE(subscriptions.linkedin_messages_used, 0)
        WHEN p_credit_type = 'guided_build' THEN COALESCE(subscriptions.guided_builds_used, 0)
      END::integer AS used
    FROM public.subscriptions AS subscriptions
    WHERE subscriptions.user_id = v_user_id
      AND subscriptions.status = 'active'
    ORDER BY subscriptions.created_at ASC, subscriptions.id ASC
  LOOP
    EXIT WHEN v_to_consume = 0;
    v_take := LEAST(v_to_consume, GREATEST(0, v_subscription.total - v_subscription.used));
    CONTINUE WHEN v_take = 0;

    IF p_credit_type = 'optimization' AND v_tier = 'quick' THEN
      UPDATE public.subscriptions
      SET quick_optimizations_used = quick_optimizations_used + v_take,
          optimizations_used = LEAST(optimizations_total, COALESCE(optimizations_used, 0) + v_take),
          updated_at = now()
      WHERE id = v_subscription.id AND user_id = v_user_id;
    ELSIF p_credit_type = 'optimization' AND v_tier = 'smart' THEN
      UPDATE public.subscriptions
      SET smart_optimizations_used = smart_optimizations_used + v_take,
          optimizations_used = LEAST(optimizations_total, COALESCE(optimizations_used, 0) + v_take),
          updated_at = now()
      WHERE id = v_subscription.id AND user_id = v_user_id;
    ELSIF p_credit_type = 'optimization' AND v_tier = 'deep' THEN
      UPDATE public.subscriptions
      SET deep_optimizations_used = deep_optimizations_used + v_take,
          optimizations_used = LEAST(optimizations_total, COALESCE(optimizations_used, 0) + v_take),
          updated_at = now()
      WHERE id = v_subscription.id AND user_id = v_user_id;
    ELSIF p_credit_type = 'score_check' THEN
      UPDATE public.subscriptions SET score_checks_used = score_checks_used + v_take, updated_at = now()
      WHERE id = v_subscription.id AND user_id = v_user_id;
    ELSIF p_credit_type = 'linkedin_messages' THEN
      UPDATE public.subscriptions SET linkedin_messages_used = linkedin_messages_used + v_take, updated_at = now()
      WHERE id = v_subscription.id AND user_id = v_user_id;
    ELSIF p_credit_type = 'guided_build' THEN
      UPDATE public.subscriptions SET guided_builds_used = guided_builds_used + v_take, updated_at = now()
      WHERE id = v_subscription.id AND user_id = v_user_id;
    END IF;

    v_to_consume := v_to_consume - v_take;
  END LOOP;

  IF v_to_consume <> 0 THEN
    RAISE EXCEPTION 'Credit consumption invariant failed';
  END IF;

  RETURN jsonb_build_object('success', true, 'remaining', v_available - p_quantity);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_user_credits(text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_user_credits(text, integer, text) TO authenticated;

COMMENT ON FUNCTION public.consume_user_credits(text, integer, text) IS
  'Atomically consumes credits, with Quick/Smart/Deep isolation for optimization balances.';
