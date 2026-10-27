/*
  # Auto Apply runs in the background

  Until now an application ran inside one Edge Function call, started by the
  user's browser. A form of more than a page or two exhausts that worker, and
  closing the tab abandons the run. Work is queued here instead and carried out
  by a worker that has no such limit, so the user can start an application and
  leave.

  ## Statuses
  - queued: waiting for a worker to pick it up
  - optimizing_resume: tailoring the resume and rendering its PDF
  - needs_login: waiting for the user's sign-in for the employer's site
  - logging_in: signing in with the login they saved
  - needs_input: waiting for answers only the user can give
  - filling_form: filling the employer's form
  - submitting: the Submit button is about to be pressed
  - submitted: the employer's site confirmed it
  - submission_uncertain: Submit was pressed and no confirmation was seen; the
    employer may have it, so it is never retried automatically
  - needs_manual_action: the site asks for something no agent may do for the
    user, such as a captcha, a verification code, or creating an account
  - failed: it certainly was not sent; a new attempt is allowed

  Every status except `failed` holds the one-live-application lock, so
  `needs_manual_action` and `submission_uncertain` are not silently retried.

  ## Claiming
  `claim_auto_apply_work` hands a worker a batch of queued rows and marks them
  taken in the same statement, under FOR UPDATE SKIP LOCKED, so two workers
  running at once never take the same application.
*/

-- ---------------------------------------------------------------- statuses --

DO $$
DECLARE
  existing record;
BEGIN
  FOR existing IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'auto_apply_applications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE auto_apply_applications DROP CONSTRAINT %I', existing.conname);
  END LOOP;
END $$;

-- A paused row was waiting for an answer; `paused_at_field` holds the question.
UPDATE auto_apply_applications SET status = CASE status
  WHEN 'optimizing' THEN 'optimizing_resume'
  WHEN 'filling'    THEN 'filling_form'
  WHEN 'uncertain'  THEN 'submission_uncertain'
  WHEN 'paused'     THEN 'needs_input'
  ELSE status
END
WHERE status IN ('optimizing', 'filling', 'uncertain', 'paused');

ALTER TABLE auto_apply_applications
  ALTER COLUMN status SET DEFAULT 'queued';

ALTER TABLE auto_apply_applications
  ADD CONSTRAINT auto_apply_applications_status_check
  CHECK (status IN (
    'queued', 'optimizing_resume', 'needs_login', 'logging_in', 'needs_input',
    'filling_form', 'submitting', 'submitted', 'submission_uncertain',
    'needs_manual_action', 'failed'
  ));

-- ----------------------------------------------------- state across a pause --

-- What the run is waiting for, so the dashboard can show it in a later session.
-- Until now this lived in the browser's memory and was lost on reload.
ALTER TABLE auto_apply_applications
  ADD COLUMN IF NOT EXISTS pending_questions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS login_site text,
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0,
  -- Answers the user gave for this application alone. A tick against one
  -- employer's declaration authorises that application and nothing else, so it
  -- is kept here rather than remembered on the profile and reused elsewhere.
  ADD COLUMN IF NOT EXISTS given_answers jsonb DEFAULT '{}'::jsonb;

-- The lock still covers every status but `failed`, so the wording above holds.
CREATE UNIQUE INDEX IF NOT EXISTS auto_apply_one_live_application
  ON auto_apply_applications (user_id, job_listing_id)
  WHERE status <> 'failed';

-- Workers read this every few seconds; keep it to the rows they can take.
CREATE INDEX IF NOT EXISTS auto_apply_queued
  ON auto_apply_applications (created_at)
  WHERE status = 'queued';

-- ---------------------------------------------------------------- claiming --

CREATE OR REPLACE FUNCTION claim_auto_apply_work(worker_id text, batch integer DEFAULT 1)
RETURNS SETOF auto_apply_applications
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE auto_apply_applications AS application
  SET status = 'optimizing_resume',
      claimed_by = worker_id,
      claimed_at = now(),
      attempts = application.attempts + 1,
      updated_at = now()
  WHERE application.id IN (
    SELECT queued.id
    FROM auto_apply_applications AS queued
    WHERE queued.status = 'queued'
    ORDER BY queued.created_at
    LIMIT GREATEST(batch, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING application.*;
$$;

-- Only a worker holding the service role may claim work; a signed-in user must
-- not be able to take applications, least of all anyone else's.
REVOKE ALL ON FUNCTION claim_auto_apply_work(text, integer) FROM public;
REVOKE ALL ON FUNCTION claim_auto_apply_work(text, integer) FROM anon;
REVOKE ALL ON FUNCTION claim_auto_apply_work(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_auto_apply_work(text, integer) TO service_role;

-- ------------------------------------------------------------ stalled rows --

/*
  A worker that dies mid-application leaves its row claimed. Nothing was sent in
  that case unless the row had already reached `submitting`, which is never
  retried, so anything else still claimed after an hour goes back on the queue.
*/
CREATE OR REPLACE FUNCTION requeue_stalled_auto_apply(older_than interval DEFAULT '1 hour')
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stalled AS (
    UPDATE auto_apply_applications
    SET status = 'queued', claimed_by = NULL, claimed_at = NULL, updated_at = now()
    WHERE claimed_at < now() - older_than
      AND status IN ('optimizing_resume', 'logging_in', 'filling_form')
      AND attempts < 3
    RETURNING 1
  )
  SELECT count(*)::integer FROM stalled;
$$;

REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM public;
REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM anon;
REVOKE ALL ON FUNCTION requeue_stalled_auto_apply(interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION requeue_stalled_auto_apply(interval) TO service_role;
