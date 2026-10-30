/*
  # A run that keeps dying is told so, rather than left spinning

  Replaces the function from 20261028100000, which is already applied and so
  cannot be amended in place.

  `attempts` counts every claim, and an answered question is a claim too, so a
  form that pauses twice reaches 3 with nothing wrong. A worker that then stops
  mid-run left the row in an in-flight status that the sweep skips for good: the
  page says "In progress" forever, and the row holds the one-live-application
  lock, so the job can never be tried again.

  Nothing was sent, because any run that reached Submit is `submitting`, which
  is settled first. So a worn-out row can safely become `failed`.
*/

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
    RETURNING 1
  )
  SELECT ((SELECT count(*) FROM settled) + (SELECT count(*) FROM stalled) + (SELECT count(*) FROM worn_out))::integer;
$$;

REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM public;
REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM anon;
REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION requeue_stalled_auto_apply(interval) TO service_role;
