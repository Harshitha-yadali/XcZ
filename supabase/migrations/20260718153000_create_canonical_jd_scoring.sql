-- Canonical, versioned JD Match score cache and per-user usage history.
-- Score rows contain no resume or JD content, only hashes and deterministic results.

CREATE TABLE IF NOT EXISTS public.canonical_jd_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  input_hash text NOT NULL,
  resume_hash text NOT NULL,
  job_description_hash text NOT NULL,
  candidate_type text NOT NULL CHECK (candidate_type IN ('fresher', 'experienced', 'student')),
  scoring_version text NOT NULL,
  overall_score integer NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  score_result jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (input_hash, scoring_version)
);

CREATE TABLE IF NOT EXISTS public.canonical_jd_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_id uuid NOT NULL REFERENCES public.canonical_jd_scores(id) ON DELETE RESTRICT,
  context text NOT NULL CHECK (context IN (
    'quick_scan', 'smart_before', 'smart_after', 'deep_before', 'deep_after', 'resume_score_checker'
  )),
  run_id text,
  cache_hit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS canonical_jd_scores_resume_jd_idx
  ON public.canonical_jd_scores (resume_hash, job_description_hash, candidate_type, scoring_version);
CREATE INDEX IF NOT EXISTS canonical_jd_score_history_user_created_idx
  ON public.canonical_jd_score_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS canonical_jd_score_history_run_idx
  ON public.canonical_jd_score_history (run_id) WHERE run_id IS NOT NULL;

ALTER TABLE public.canonical_jd_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_jd_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read canonical scores used by them" ON public.canonical_jd_scores;
CREATE POLICY "Users read canonical scores used by them"
  ON public.canonical_jd_scores FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.canonical_jd_score_history history
      WHERE history.score_id = canonical_jd_scores.id AND history.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own canonical score history" ON public.canonical_jd_score_history;
CREATE POLICY "Users read own canonical score history"
  ON public.canonical_jd_score_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Writes are intentionally restricted to the canonical scoring Edge Function's
-- service-role client. Browsers cannot submit or alter official numeric scores.
REVOKE INSERT, UPDATE, DELETE ON public.canonical_jd_scores FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.canonical_jd_score_history FROM authenticated, anon;

ALTER TABLE public.optimization_sessions
  ADD COLUMN IF NOT EXISTS canonical_before_score_id uuid REFERENCES public.canonical_jd_scores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canonical_after_score_id uuid REFERENCES public.canonical_jd_scores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scoring_version text,
  ADD COLUMN IF NOT EXISTS before_input_hash text,
  ADD COLUMN IF NOT EXISTS after_input_hash text;
