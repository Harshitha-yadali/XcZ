alter table if exists public.session_services
  add column if not exists regular_price integer;

alter table if exists public.session_services
  add column if not exists promo_codes jsonb not null default '[]'::jsonb;

update public.session_services
set regular_price = coalesce(regular_price, price)
where regular_price is null;
