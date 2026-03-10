alter table public.job_listings
  add column if not exists expires_at timestamptz;

create index if not exists idx_job_listings_expires_at
  on public.job_listings (expires_at);
