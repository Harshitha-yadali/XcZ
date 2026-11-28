-- First-party funnel tracking. The browser inserts events (anon + signed-in);
-- nobody can read rows directly. Admins read aggregates via funnel_report /
-- funnel_daily (SECURITY DEFINER). Admin check mirrors
-- supabase/functions/_shared/auth.ts: user_profiles.role = 'admin' OR the
-- owner email primoboostai@gmail.com (verified by Supabase Auth).

CREATE TABLE IF NOT EXISTS public.funnel_events (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL CHECK (length(event) <= 64),
  anon_id text NOT NULL CHECK (length(anon_id) <= 64),
  session_id text CHECK (length(session_id) <= 64),
  user_id uuid NULL,
  path text CHECK (length(path) <= 256),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(meta) < 2000)
);

CREATE INDEX IF NOT EXISTS funnel_events_event_created_idx ON public.funnel_events (event, created_at);
CREATE INDEX IF NOT EXISTS funnel_events_created_idx ON public.funnel_events (created_at);

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert own funnel events" ON public.funnel_events;
CREATE POLICY "Anyone can insert own funnel events"
  ON public.funnel_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
-- No SELECT / UPDATE / DELETE policies: rows are write-only from the client.

GRANT INSERT ON public.funnel_events TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.funnel_events_id_seq TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.funnel_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND lower(u.email) = 'primoboostai@gmail.com')
  );
$$;
REVOKE ALL ON FUNCTION public.funnel_is_admin() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.funnel_report(p_days int DEFAULT 30)
RETURNS TABLE (step_order int, event text, people bigint, events bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.funnel_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH steps(step_order, event) AS (
    VALUES
      (1, 'home_view'), (2, 'signup'), (3, 'score_check_view'), (4, 'score_check_start'),
      (5, 'score_check_done'), (6, 'fix_resume_click'), (7, 'optimizer_view'), (8, 'tier_picked'),
      (9, 'boost_done'), (10, 'payment_start'), (11, 'payment_success'), (12, 'optimize_done')
  ),
  counts AS (
    SELECT f.event,
           count(DISTINCT coalesce(f.user_id::text, f.anon_id)) AS people,
           count(*) AS events
    FROM public.funnel_events f
    WHERE f.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)))
    GROUP BY f.event
  )
  SELECT s.step_order, s.event, coalesce(c.people, 0)::bigint, coalesce(c.events, 0)::bigint
  FROM steps s LEFT JOIN counts c ON c.event = s.event
  UNION ALL
  SELECT (100 + row_number() OVER (ORDER BY c.event))::int, c.event, c.people, c.events
  FROM counts c WHERE c.event NOT IN (SELECT s2.event FROM steps s2)
  ORDER BY 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.funnel_daily(p_days int DEFAULT 14)
RETURNS TABLE (day date, event text, people bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.funnel_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT (f.created_at AT TIME ZONE 'Asia/Kolkata')::date AS day,
         f.event,
         count(DISTINCT coalesce(f.user_id::text, f.anon_id))::bigint AS people
  FROM public.funnel_events f
  WHERE f.created_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 14), 365)))
  GROUP BY 1, 2
  ORDER BY 1, 2;
END;
$$;

REVOKE ALL ON FUNCTION public.funnel_report(int) FROM public, anon;
REVOKE ALL ON FUNCTION public.funnel_daily(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.funnel_report(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.funnel_daily(int) TO authenticated;
