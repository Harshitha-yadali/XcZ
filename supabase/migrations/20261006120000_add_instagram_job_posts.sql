-- Job post → Instagram Reel → comment-to-DM automation.
-- A row is queued when an admin posts a job (queue-instagram-job-post), the
-- Reel is rendered in GitHub Actions, and publish-instagram-posts posts it at
-- scheduled_at. Only edge functions and the render job (service role) touch
-- these tables, so RLS is on with no policies.

create table if not exists public.instagram_job_posts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.job_listings(id) on delete cascade,
  status text not null default 'pending_render'
    check (status in ('pending_render', 'rendered', 'container_created', 'published', 'failed')),
  scheduled_at timestamptz not null unique,
  caption text not null,
  -- Caption hook A/B test arm; null when the job is not in the test.
  hook_variant text check (hook_variant in ('role', 'salary')),
  card jsonb not null,
  video_url text,
  ig_container_id text,
  ig_media_id text unique,
  error text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists idx_instagram_job_posts_status
  on public.instagram_job_posts (status, scheduled_at);

alter table public.instagram_job_posts enable row level security;

-- One row per comment that was sent a DM, so a redelivered webhook cannot DM twice.
create table if not exists public.instagram_comment_dms (
  comment_id text primary key,
  ig_media_id text not null,
  created_at timestamptz not null default now()
);

alter table public.instagram_comment_dms enable row level security;

-- Caption hook test: "LINK" comments in the first 7 days per Reel, by variant.
-- Only Reels that have had their full 7 days count. Decide once each variant
-- has 30 Reels, and treat a gap under 25% in the median as no difference:
-- at three Reels a day the test cannot detect anything smaller.
create or replace view public.instagram_hook_test with (security_invoker = true) as
select
  p.hook_variant,
  count(*) as reels,
  sum(d.dms) as link_comments,
  round(avg(d.dms), 1) as avg_per_reel,
  percentile_cont(0.5) within group (order by d.dms) as median_per_reel
from public.instagram_job_posts p
cross join lateral (
  select count(*) as dms
  from public.instagram_comment_dms c
  where c.ig_media_id = p.ig_media_id
    and c.created_at < p.published_at + interval '7 days'
) d
where p.status = 'published'
  and p.hook_variant is not null
  and p.published_at < now() - interval '7 days'
group by p.hook_variant;

-- Public because Meta downloads the Reel from its URL.
insert into storage.buckets (id, name, public)
values ('instagram-reels', 'instagram-reels', true)
on conflict (id) do nothing;

-- Publish due Reels every 10 minutes. Uses the same app.settings values as the
-- job digest cron; both must be set on the database for the call to succeed.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'publish-instagram-posts',
  '*/10 * * * *',
  $$
  select
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/publish-instagram-posts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
