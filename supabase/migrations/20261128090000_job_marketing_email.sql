-- Daily job marketing email: up to 200 users a day through the Hostinger
-- mailbox, everyone in turn (never mailed first, then oldest mailed), most
-- recently active first. One row per user who was mailed or unsubscribed.
create table if not exists marketing_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_sent_at timestamptz,
  sent_count integer not null default 0,
  unsubscribed_at timestamptz
);
-- Service role only: no policies.
alter table marketing_emails enable row level security;
create index if not exists marketing_emails_last_sent on marketing_emails (last_sent_at);

-- The next users to mail. auth.users is not reachable through the API, so
-- this runs as definer and only the service role may call it.
create or replace function next_marketing_recipients(p_limit integer)
returns table (user_id uuid, email text, full_name text)
language sql
security definer
set search_path = public, auth
as $$
  select u.id, u.email::text, coalesce(nullif(p.full_name, ''), u.raw_user_meta_data->>'full_name', '')
  from auth.users u
  left join marketing_emails m on m.user_id = u.id
  left join user_profiles p on p.id = u.id
  where m.unsubscribed_at is null
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and u.email is not null
    and (m.last_sent_at is null or m.last_sent_at < now() - interval '6 days')
  order by m.last_sent_at nulls first, u.last_sign_in_at desc nulls last
  limit greatest(0, least(p_limit, 50));
$$;
revoke all on function next_marketing_recipients(integer) from public, anon, authenticated;
grant execute on function next_marketing_recipients(integer) to service_role;

-- Every 10 minutes from 08:30 to 11:20 IST (03:00-05:50 UTC); the function
-- sends at most 20 a run and stops at 200 a day.
select cron.unschedule('job-marketing-email') where exists (select 1 from cron.job where jobname = 'job-marketing-email');
select cron.schedule(
  'job-marketing-email',
  '*/10 3-5 * * *',
  $$
  select net.http_post(
    url := 'https://rixmudvtbfkjpwjoefon.supabase.co/functions/v1/send-job-marketing',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'check_jobs_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  ) as request_id;
  $$
);
