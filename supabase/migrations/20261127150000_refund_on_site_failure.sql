/*
  # Give the Quick credit back when an Auto Apply fails through no fault of the user

  The browser reserves one Quick credit per application and finalizes it as
  soon as the application is queued. When the runner then fails on the
  employer's side (site down, job closed, form would not load, captcha or bot
  wall, runner crash) the user has paid for nothing. This lets the runner, and
  only the runner, give that one credit back, once.

  1. `auto_apply_credit_links` ties an application to the reservation that paid
     for it. It is a table of its own, not a column, because users may update
     their own `auto_apply_applications` rows: a column there could be pointed at
     any other finalized reservation of theirs. Only auto-apply-queue (service
     role) writes it. RLS on, no policies.
  2. `refund_auto_apply_credit(application_id)` reverses a reserved OR finalized
     reservation. Idempotent: the reservation row is locked and a 'refunded' one
     is returned as is. service_role only. Whether a failure deserves a refund is
     decided by the caller (worker, see _shared/autoApplyRefund.ts).
  3. `requeue_stalled_auto_apply`: a run that died 3 times is a runner crash, so
     the row it settles as `failed` is refunded too.
*/

CREATE TABLE IF NOT EXISTS public.auto_apply_credit_links (
  application_id uuid PRIMARY KEY REFERENCES public.auto_apply_applications(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL UNIQUE REFERENCES public.credit_usage_reservations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_apply_credit_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auto_apply_credit_links FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.refund_auto_apply_credit(p_application_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.credit_usage_reservations%ROWTYPE;
  v_allocation jsonb;
  v_id uuid;
  v_quantity integer;
BEGIN
  SELECT reservations.* INTO v_row
  FROM public.auto_apply_credit_links links
  JOIN public.credit_usage_reservations reservations ON reservations.id = links.reservation_id
  WHERE links.application_id = p_application_id
  FOR UPDATE OF reservations;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'No credit is linked to this application.'); END IF;
  IF v_row.status = 'refunded' THEN RETURN jsonb_build_object('success', true, 'reservation_id', v_row.id, 'status', 'refunded'); END IF;

  -- Same reversal as refund_user_credit_reservation, keyed on the
  -- reservation's own user since there is no auth.uid() for the service role.
  FOR v_allocation IN SELECT value FROM jsonb_array_elements(v_row.allocations)
  LOOP
    v_id := (v_allocation->>'id')::uuid;
    v_quantity := (v_allocation->>'quantity')::integer;
    IF v_allocation->>'source' = 'addon' THEN
      UPDATE public.user_addon_credits SET quantity_remaining = quantity_remaining + v_quantity
      WHERE id = v_id AND user_id = v_row.user_id;
    ELSIF v_row.credit_type = 'score_check' THEN
      UPDATE public.subscriptions SET score_checks_used = GREATEST(0, score_checks_used - v_quantity), updated_at = now()
      WHERE id = v_id AND user_id = v_row.user_id;
    ELSIF v_row.optimization_tier = 'quick' THEN
      UPDATE public.subscriptions SET
        quick_optimizations_used = GREATEST(0, quick_optimizations_used - v_quantity),
        optimizations_used = GREATEST(0, optimizations_used - v_quantity), updated_at = now()
      WHERE id = v_id AND user_id = v_row.user_id;
    ELSIF v_row.optimization_tier = 'smart' THEN
      UPDATE public.subscriptions SET
        smart_optimizations_used = GREATEST(0, smart_optimizations_used - v_quantity),
        optimizations_used = GREATEST(0, optimizations_used - v_quantity), updated_at = now()
      WHERE id = v_id AND user_id = v_row.user_id;
    ELSIF v_row.optimization_tier = 'deep' THEN
      UPDATE public.subscriptions SET
        deep_optimizations_used = GREATEST(0, deep_optimizations_used - v_quantity),
        optimizations_used = GREATEST(0, optimizations_used - v_quantity), updated_at = now()
      WHERE id = v_id AND user_id = v_row.user_id;
    END IF;
  END LOOP;

  UPDATE public.credit_usage_reservations SET status = 'refunded', refunded_at = now() WHERE id = v_row.id;
  RETURN jsonb_build_object('success', true, 'reservation_id', v_row.id, 'status', 'refunded');
END;
$$;

REVOKE ALL ON FUNCTION public.refund_auto_apply_credit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_auto_apply_credit(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.refund_auto_apply_credit(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refund_auto_apply_credit(uuid) TO service_role;

-- Same as 20261030100000, plus a refund for each worn-out row.
CREATE OR REPLACE FUNCTION requeue_stalled_auto_apply(older_than interval DEFAULT '1 hour')
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH settled AS (
    UPDATE auto_apply_applications
    SET status = 'submission_uncertain',
        error_message = 'We pressed Submit but stopped before the site answered, so we cannot say this was sent. Check your email for a confirmation from the employer before applying again.',
        claimed_by = NULL,
        claimed_at = NULL,
        updated_at = now()
    WHERE COALESCE(claimed_at, updated_at) < now() - older_than
      AND status = 'submitting'
    RETURNING 1
  ), stalled AS (
    UPDATE auto_apply_applications
    SET status = 'queued',
        claimed_by = NULL,
        claimed_at = NULL,
        updated_at = now()
    WHERE COALESCE(claimed_at, updated_at) < now() - older_than
      AND status IN ('optimizing_resume', 'logging_in', 'filling_form')
      AND attempts < 3
    RETURNING 1
  ), worn_out AS (
    UPDATE auto_apply_applications
    SET status = 'failed',
        error_message = 'This application stopped part way through several times, and nothing was sent. Please try again.',
        claimed_by = NULL,
        claimed_at = NULL,
        updated_at = now()
    WHERE COALESCE(claimed_at, updated_at) < now() - older_than
      AND status IN ('optimizing_resume', 'logging_in', 'filling_form')
      AND attempts >= 3
    RETURNING id
  ), refunds AS (
    -- One row per worn-out application; counting it is what makes it run.
    SELECT public.refund_auto_apply_credit(id) FROM worn_out
  )
  SELECT ((SELECT count(*) FROM settled) + (SELECT count(*) FROM stalled) + (SELECT count(*) FROM refunds))::integer;
$$;

REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM public;
REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM anon;
REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION requeue_stalled_auto_apply(interval) TO service_role;
