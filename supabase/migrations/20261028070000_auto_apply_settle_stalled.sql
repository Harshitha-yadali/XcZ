/*
  # Settle applications a worker abandoned

  Replaces requeue_stalled_auto_apply from 20261027120000, which is already
  applied and so cannot be amended in place.

  That version requeues a run the worker never finished, and deliberately
  leaves `submitting` alone: Submit had been pressed, and sending it again
  could put a second application in front of the same employer. But nothing
  settled those rows either, so a worker stopped between the click and the
  outcome left the application showing "submitting" for good.

  Such a run is exactly what `submission_uncertain` is for. It is never sent
  again, it keeps the one-live-application lock, and the user is told to look
  for a confirmation rather than apply twice.

  `older_than` must stay longer than a run can legitimately take, or a working
  application is settled out from under itself.
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
    WHERE claimed_at < now() - older_than
      AND status = 'submitting'
    RETURNING 1
  ), stalled AS (
    UPDATE auto_apply_applications
    SET status = 'queued',
        claimed_by = NULL,
        claimed_at = NULL,
        updated_at = now()
    WHERE claimed_at < now() - older_than
      AND status IN ('optimizing_resume', 'logging_in', 'filling_form')
      AND attempts < 3
    RETURNING 1
  )
  SELECT ((SELECT count(*) FROM settled) + (SELECT count(*) FROM stalled))::integer;
$$;

REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM public;
REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM anon;
REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION requeue_stalled_auto_apply(interval) TO service_role;
