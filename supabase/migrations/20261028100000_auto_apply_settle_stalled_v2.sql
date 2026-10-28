/*
  # Judge an abandoned application by when it last moved

  Replaces the function from 20261028070000, which is already applied and so
  cannot be amended in place.

  That version decided a run was abandoned from `claimed_at`. But a row can sit
  in an in-flight status with `claimed_at` NULL - the Amazon application stuck
  at `submitting` since this morning is one - and a NULL satisfies no
  comparison, so those rows were invisible to the sweep for good. The very rows
  the sweep exists to rescue were the ones it could not see.

  `updated_at` is always set, and is what "has not moved in an hour" actually
  means, so it stands in wherever a claim time is missing.
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
  )
  SELECT ((SELECT count(*) FROM settled) + (SELECT count(*) FROM stalled))::integer;
$$;

REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM public;
REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM anon;
REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION requeue_stalled_auto_apply(interval) TO service_role;
