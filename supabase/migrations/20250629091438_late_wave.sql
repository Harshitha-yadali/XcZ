\n\n-- Grant usage on the auth schema to authenticated users\nGRANT USAGE ON SCHEMA auth TO authenticated;
\n\n-- Grant select permission on auth.users table to authenticated users\n-- This is needed for RLS policies that check user metadata or roles\nGRANT SELECT ON TABLE auth.users TO authenticated;
;
