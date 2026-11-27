-- Whether the runner can apply to a job by itself. The worker test-fills each
-- job with a test profile, never pressing Submit: new uploads within minutes,
-- every job again after three days, and at once when a real application hits a
-- sign-in, captcha or bot wall. Only 'works' jobs get Auto Apply; the rest get
-- Smart Apply (tailored resume, the user submits).
ALTER TABLE job_listings
  ADD COLUMN IF NOT EXISTS apply_check text CHECK (apply_check IN ('works', 'blocked')),
  ADD COLUMN IF NOT EXISTS apply_check_reason text,
  ADD COLUMN IF NOT EXISTS apply_checked_at timestamptz;
CREATE INDEX IF NOT EXISTS job_listings_apply_check_due ON job_listings (apply_checked_at NULLS FIRST, created_at DESC) WHERE is_active;
