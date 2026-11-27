-- publish-instagram-posts read app.settings.* (not set on hosted Supabase, so
-- it failed every run) and job-digest-every-8-hours sent the public anon key
-- (refused by the function's admin check). Both now authenticate with the
-- Vault cron secret like check-job-links; the functions accept
-- CHECK_JOBS_SECRET (_shared/auth.ts) and are deployed with --no-verify-jwt.
-- Schedules are unchanged.
do $$
declare
  j record;
  fn text;
begin
  for j in select jobid, jobname from cron.job
           where jobname in ('publish-instagram-posts', 'job-digest-every-8-hours') loop
    fn := case j.jobname when 'publish-instagram-posts' then 'publish-instagram-posts'
                         else 'process-daily-job-digest' end;
    perform cron.alter_job(j.jobid, command := format($cmd$
  select net.http_post(
    url := 'https://rixmudvtbfkjpwjoefon.supabase.co/functions/v1/%s',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'check_jobs_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  ) as request_id;
  $cmd$, fn));
  end loop;
end $$;
