create table if not exists public.pricing_plan_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text not null default '',
  discount_percentage integer not null check (discount_percentage >= 1 and discount_percentage <= 100),
  applicable_plan_ids text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pricing_plan_coupons enable row level security;

create unique index if not exists pricing_plan_coupons_code_upper_idx
  on public.pricing_plan_coupons ((upper(code)));

create index if not exists pricing_plan_coupons_is_active_idx
  on public.pricing_plan_coupons (is_active);

create index if not exists pricing_plan_coupons_applicable_plan_ids_idx
  on public.pricing_plan_coupons using gin (applicable_plan_ids);

drop trigger if exists pricing_plan_coupons_set_updated_at on public.pricing_plan_coupons;

create trigger pricing_plan_coupons_set_updated_at
before update on public.pricing_plan_coupons
for each row
execute function public.update_updated_at_column();

drop policy if exists "Admins can view pricing plan coupons" on public.pricing_plan_coupons;
drop policy if exists "Admins can insert pricing plan coupons" on public.pricing_plan_coupons;
drop policy if exists "Admins can update pricing plan coupons" on public.pricing_plan_coupons;
drop policy if exists "Admins can delete pricing plan coupons" on public.pricing_plan_coupons;

create policy "Admins can view pricing plan coupons"
  on public.pricing_plan_coupons
  for select
  to authenticated
  using (is_admin((select auth.uid())));

create policy "Admins can insert pricing plan coupons"
  on public.pricing_plan_coupons
  for insert
  to authenticated
  with check (is_admin((select auth.uid())));

create policy "Admins can update pricing plan coupons"
  on public.pricing_plan_coupons
  for update
  to authenticated
  using (is_admin((select auth.uid())))
  with check (is_admin((select auth.uid())));

create policy "Admins can delete pricing plan coupons"
  on public.pricing_plan_coupons
  for delete
  to authenticated
  using (is_admin((select auth.uid())));
