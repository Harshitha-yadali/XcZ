/*
  # One live application per user and job

  Auto-apply must never send the same application twice. The rule is enforced
  here, in the database, so it holds for two tabs, two devices or a retry,
  whatever the app does.

  ## Statuses
  - optimizing, filling, paused: being prepared, or waiting on the user
  - submitting: the Submit button is about to be pressed
  - submitted: the employer's site confirmed it
  - uncertain: Submit was pressed and no confirmation was seen; the employer
    may have it, so it is never retried automatically
  - failed: it certainly was not sent; a new attempt is allowed

  Every status except `failed` holds the lock.

  ## Existing rows
  Where a user already has several live rows for one job, the submitted one
  (or else the newest) is kept and the others are marked failed, so the index
  can be created.
*/

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

ALTER TABLE auto_apply_applications
  ADD CONSTRAINT auto_apply_applications_status_check
  CHECK (status IN ('optimizing', 'filling', 'paused', 'submitting', 'submitted', 'uncertain', 'failed'));

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, job_listing_id
           ORDER BY (status = 'submitted') DESC, created_at DESC
         ) AS position
  FROM auto_apply_applications
  WHERE status <> 'failed'
)
UPDATE auto_apply_applications AS application
SET status = 'failed',
    error_message = concat_ws(' ', application.error_message, '(replaced by a later attempt for the same job)')
FROM ranked
WHERE application.id = ranked.id AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS auto_apply_one_live_application
  ON auto_apply_applications (user_id, job_listing_id)
  WHERE status <> 'failed';
