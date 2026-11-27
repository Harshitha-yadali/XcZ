-- Paid AI models were open to any signed-in user: credits were reserved by the
-- browser, so calling ai-proxy directly skipped them. ai-proxy now asks here
-- before every paid call. Apply this before deploying that ai-proxy.

ALTER TABLE public.credit_usage_reservations
  ADD COLUMN IF NOT EXISTS ai_calls integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.ai_daily_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  calls integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
-- No policies: only the service role reads or writes it.
ALTER TABLE public.ai_daily_usage ENABLE ROW LEVEL SECURITY;

-- Returns 'ok', 'credit_required' or 'daily_limit'.
CREATE OR REPLACE FUNCTION public.claim_paid_ai_call(p_user_id uuid, p_model text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation uuid;
  v_unpaid integer;
  v_calls integer;
BEGIN
  -- One at a time per user, so parallel requests cannot slip past a limit.
  PERFORM pg_advisory_xact_lock(hashtextextended('ai-call:' || p_user_id::text, 0));

  -- Reserving, using the AI and then refunding must not be an endless loop.
  SELECT COALESCE(SUM(ai_calls), 0) INTO v_unpaid
  FROM public.credit_usage_reservations
  WHERE user_id = p_user_id AND status = 'refunded'
    AND created_at > now() - interval '24 hours';

  IF v_unpaid < 60 THEN
    SELECT id INTO v_reservation
    FROM public.credit_usage_reservations
    WHERE user_id = p_user_id
      AND credit_type = 'optimization'
      AND status = 'reserved'
      AND created_at > now() - interval '1 hour'
      AND ai_calls < 30
      AND (
        p_model IN ('openai/gpt-6-luna', 'google/gemini-3.5-flash-lite')
        OR (p_model IN ('openai/gpt-6.1-terra', 'openai/gpt-5.6-terra') AND optimization_tier = 'smart')
        OR (p_model IN ('anthropic/claude-sonnet-5.5', 'anthropic/claude-opus-4.8') AND optimization_tier = 'deep')
      )
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_reservation IS NOT NULL THEN
    UPDATE public.credit_usage_reservations SET ai_calls = ai_calls + 1 WHERE id = v_reservation;
    RETURN 'ok';
  END IF;

  IF p_model <> 'google/gemini-3.5-flash-lite' THEN
    RETURN 'credit_required';
  END IF;

  -- Auto Apply tailors resumes on the cheapest model without a reservation.
  INSERT INTO public.ai_daily_usage AS usage (user_id, day, calls)
  VALUES (p_user_id, current_date, 1)
  ON CONFLICT (user_id, day) DO UPDATE SET calls = usage.calls + 1
    WHERE usage.calls < 40
  RETURNING calls INTO v_calls;

  RETURN CASE WHEN v_calls IS NULL THEN 'daily_limit' ELSE 'ok' END;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_paid_ai_call(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_paid_ai_call(uuid, text) TO service_role;
