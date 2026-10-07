/*
  # Auto-apply prerequisites

  Everything the auto-apply flow reads or writes, created only if missing, so
  this is safe to run on a database where some of it already exists:

  - optimized_resumes: the tailored resume for one job (pdf_url is a path in
    the private user-resumes bucket)
  - auto_apply_applications: one row per application attempt
  - auto_apply_analytics: daily counts, written by the edge function
  - user-resumes bucket, where a user may write only inside their own folder
  - user_profiles.apply_answers: remembered answers to form questions
*/

CREATE TABLE IF NOT EXISTS optimized_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  job_listing_id uuid REFERENCES job_listings(id) ON DELETE CASCADE NOT NULL,
  resume_content jsonb NOT NULL,
  pdf_url text,
  docx_url text,
  optimization_score integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE optimized_resumes ADD COLUMN IF NOT EXISTS resume_content jsonb;
ALTER TABLE optimized_resumes ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE optimized_resumes ADD COLUMN IF NOT EXISTS optimization_score integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS auto_apply_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_listing_id uuid REFERENCES job_listings(id) ON DELETE CASCADE NOT NULL,
  resume_version_id uuid REFERENCES optimized_resumes(id) ON DELETE SET NULL,
  platform text NOT NULL,
  application_url text NOT NULL,
  status text DEFAULT 'optimizing' CHECK (status IN ('optimizing', 'filling', 'submitted', 'failed', 'paused')),
  submission_time timestamptz,
  error_message text,
  screenshot_url text,
  form_data_captured jsonb DEFAULT '{}'::jsonb,
  paused_at_field text,
  retry_count integer DEFAULT 0,
  time_taken_seconds integer,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS auto_apply_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date DEFAULT CURRENT_DATE NOT NULL,
  total_applications integer DEFAULT 0,
  successful_applications integer DEFAULT 0,
  failed_applications integer DEFAULT 0,
  average_match_score decimal(5,2),
  average_time_saved_minutes integer DEFAULT 0,
  platforms_used jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, date)
);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS apply_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE optimized_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_apply_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_apply_analytics ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public)
VALUES ('user-resumes', 'user-resumes', false)
ON CONFLICT (id) DO NOTHING;

-- CREATE POLICY has no IF NOT EXISTS, so each one is guarded by name.
-- Status changes on applications are made by the edge function (service role),
-- so users only need to read and create their own rows.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'optimized_resumes' AND policyname = 'auto_apply_read_own_resumes') THEN
    CREATE POLICY auto_apply_read_own_resumes ON optimized_resumes
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'optimized_resumes' AND policyname = 'auto_apply_create_own_resumes') THEN
    CREATE POLICY auto_apply_create_own_resumes ON optimized_resumes
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'auto_apply_applications' AND policyname = 'auto_apply_read_own_applications') THEN
    CREATE POLICY auto_apply_read_own_applications ON auto_apply_applications
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'auto_apply_applications' AND policyname = 'auto_apply_create_own_applications') THEN
    CREATE POLICY auto_apply_create_own_applications ON auto_apply_applications
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'auto_apply_analytics' AND policyname = 'auto_apply_read_own_analytics') THEN
    CREATE POLICY auto_apply_read_own_analytics ON auto_apply_analytics
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'auto_apply_upload_own_resume_files') THEN
    CREATE POLICY auto_apply_upload_own_resume_files ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'user-resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'auto_apply_read_own_resume_files') THEN
    CREATE POLICY auto_apply_read_own_resume_files ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'user-resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
