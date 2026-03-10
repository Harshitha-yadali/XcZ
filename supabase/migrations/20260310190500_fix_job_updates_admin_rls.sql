/*
  # Fix job_updates admin RLS and align with app admin checks

  Problem:
  - job_updates admin policies checked auth.users raw metadata directly
  - automatic WhatsApp update inserts were failing with RLS for admin-created jobs

  Fix:
  - reuse the existing is_admin(auth.uid()) helper backed by user_profiles.role
  - keep public read access for active updates
*/

DROP POLICY IF EXISTS "Admins can view all job updates" ON public.job_updates;
DROP POLICY IF EXISTS "Admins can insert job updates" ON public.job_updates;
DROP POLICY IF EXISTS "Admins can update job updates" ON public.job_updates;
DROP POLICY IF EXISTS "Admins can delete job updates" ON public.job_updates;

CREATE POLICY "Admins can view all job updates"
  ON public.job_updates
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert job updates"
  ON public.job_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update job updates"
  ON public.job_updates
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete job updates"
  ON public.job_updates
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
