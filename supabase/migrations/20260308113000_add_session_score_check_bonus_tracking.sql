alter table if exists public.session_bookings add column if not exists score_check_credits_awarded integer not null default 0, add column if not exists score_check_credits_granted_at timestamptz;;
alter table if exists public.user_addon_credits add column if not exists source_booking_id text;;
create unique index if not exists user_addon_credits_source_booking_type_idx on public.user_addon_credits (source_booking_id, addon_type_id) where source_booking_id is not null;;
