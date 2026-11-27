-- Crons that read app.settings.* never ran: those settings are not set on
-- this project (and can't be on hosted Supabase). Point every such job at the
-- project URL and authenticate with the Vault cron secret, the same way
-- check-job-links does. Only the command changes; schedules stay as they are.
-- The called functions accept CHECK_JOBS_SECRET (see _shared/auth.ts) and are
-- deployed with --no-verify-jwt.
do $$
declare j record;
begin
  for j in select jobid, command from cron.job where command like '%app.settings.%' loop
    perform cron.alter_job(
      j.jobid,
      command := replace(replace(j.command,
        'current_setting(''app.settings.supabase_url'')',
        '''https://rixmudvtbfkjpwjoefon.supabase.co'''),
        'current_setting(''app.settings.supabase_service_role_key'')',
        '(select decrypted_secret from vault.decrypted_secrets where name = ''check_jobs_secret'')')
    );
  end loop;
end $$;
