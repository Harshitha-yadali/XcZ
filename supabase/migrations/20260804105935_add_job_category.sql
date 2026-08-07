alter table public.job_listings
  add column if not exists job_category text
  check (job_category in ('Fresher', 'Experienced', 'Internship'));

create index if not exists idx_job_listings_job_category
  on public.job_listings (job_category);
