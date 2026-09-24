/*
  # Software tools store (LinkedIn Premium, etc.)

  - Admin-managed catalog of software subscriptions sold to users
  - Anyone can view active tools; only admins (is_admin) can manage
  - buy_url / image_url restricted to http(s) so they can't carry javascript: links
*/

CREATE TABLE IF NOT EXISTS public.software_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text CHECK (image_url IS NULL OR image_url ~* '^https?://'),
  duration text NOT NULL DEFAULT '',
  price numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  original_price numeric(10, 2) CHECK (original_price IS NULL OR original_price >= 0),
  buy_url text NOT NULL CHECK (buy_url ~* '^https?://'),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.software_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active software tools"
  ON public.software_tools FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can view all software tools"
  ON public.software_tools FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert software tools"
  ON public.software_tools FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update software tools"
  ON public.software_tools FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete software tools"
  ON public.software_tools FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_software_tools_active_sort
  ON public.software_tools (is_active, sort_order);
