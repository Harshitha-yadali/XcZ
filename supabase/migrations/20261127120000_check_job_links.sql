-- Daily clean-up of closed jobs. check-job-links runs every hour and checks the
-- open jobs looked at longest ago, so each job is checked about once a day.
-- Closed jobs nobody used are deleted; ones with users' resumes or applications
-- are hidden (is_active = false), since deleting those cascades into user data.
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS link_checked_at timestamptz;
CREATE INDEX IF NOT EXISTS job_listings_link_check ON job_listings (link_checked_at NULLS FIRST) WHERE is_active;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The cron authenticates with its own secret, kept in Vault under
-- 'check_jobs_secret' and set on the function as CHECK_JOBS_SECRET. It is
-- created outside this file, so no secret is ever committed.
select cron.unschedule('check-job-links') where exists (select 1 from cron.job where jobname = 'check-job-links');
select cron.schedule(
  'check-job-links',
  '17 * * * *',
  $$
  select net.http_post(
    url := 'https://rixmudvtbfkjpwjoefon.supabase.co/functions/v1/check-job-links',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'check_jobs_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  ) as request_id;
  $$
);
