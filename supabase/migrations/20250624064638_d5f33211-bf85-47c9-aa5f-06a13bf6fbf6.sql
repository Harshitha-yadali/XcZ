
-- First, let's create the enum types if they don't exist
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('client', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.job_status AS ENUM ('applied', 'interview_scheduled', 'interviewed', 'rejected', 'offer_received');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.interview_stage AS ENUM ('screening', 'technical', 'behavioral', 'final', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add missing columns to existing user_profiles table if they don't exist
DO $$ 
BEGIN
    -- Add user_id column if it doesn't exist (references auth.users)
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'user_id') THEN
        ALTER TABLE public.user_profiles ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add role column if it doesn't exist
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
        ALTER TABLE public.user_profiles ADD COLUMN role user_role NOT NULL DEFAULT 'client';
    END IF;
    
    -- Add phone column if it doesn't exist
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'phone') THEN
        ALTER TABLE public.user_profiles ADD COLUMN phone TEXT;
    END IF;
    
    -- Add linkedin_profile column if it doesn't exist
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'linkedin_profile') THEN
        ALTER TABLE public.user_profiles ADD COLUMN linkedin_profile TEXT;
    END IF;
    
    -- Add wellfound_profile column if it doesn't exist
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'wellfound_profile') THEN
        ALTER TABLE public.user_profiles ADD COLUMN wellfound_profile TEXT;
    END IF;
    
    -- Add program_start_date column if it doesn't exist
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'program_start_date') THEN
        ALTER TABLE public.user_profiles ADD COLUMN program_start_date DATE;
    END IF;
    
    -- Add program_end_date column if it doesn't exist
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'program_end_date') THEN
        ALTER TABLE public.user_profiles ADD COLUMN program_end_date DATE;
    END IF;
END $$;

-- Create daily_updates table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.daily_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  update_date DATE NOT NULL,
  screenshots JSONB DEFAULT '[]'::jsonb,
  session_attended BOOLEAN DEFAULT false,
  session_time TEXT,
  topics_covered TEXT,
  challenges_faced TEXT,
  goals_for_tomorrow TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(client_id, update_date)
);

-- Create job_applications table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  job_url TEXT,
  application_date DATE NOT NULL,
  status job_status DEFAULT 'applied',
  notes TEXT,
  follow_up_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create interviews table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID REFERENCES public.job_applications(id) ON DELETE CASCADE,
  interview_date TIMESTAMP WITH TIME ZONE,
  interview_stage interview_stage,
  interviewer_name TEXT,
  interview_notes TEXT,
  feedback TEXT,
  result TEXT,
  next_steps TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create course_materials table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.course_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_type TEXT,
  assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  is_completed BOOLEAN DEFAULT false,
  completion_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create client_resumes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.client_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  resume_url TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create internship_records table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.internship_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  position TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  description TEXT,
  certificate_url TEXT,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create admin_notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  is_important BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internship_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can view their own profile') THEN
    CREATE POLICY "Users can view their own profile" ON public.user_profiles
      FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile" ON public.user_profiles
      FOR UPDATE USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Admins can insert user profiles') THEN
    CREATE POLICY "Admins can insert user profiles" ON public.user_profiles
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- Create RLS policies for other tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_updates' AND policyname = 'Clients can manage their own updates') THEN
    CREATE POLICY "Clients can manage their own updates" ON public.daily_updates
      FOR ALL USING (
        client_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'job_applications' AND policyname = 'Clients can manage their own job applications') THEN
    CREATE POLICY "Clients can manage their own job applications" ON public.job_applications
      FOR ALL USING (
        client_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_daily_updates_client_date ON public.daily_updates(client_id, update_date);
CREATE INDEX IF NOT EXISTS idx_job_applications_client_id ON public.job_applications(client_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications(status);
CREATE INDEX IF NOT EXISTS idx_interviews_job_application_id ON public.interviews(job_application_id);
CREATE INDEX IF NOT EXISTS idx_course_materials_assigned_to ON public.course_materials(assigned_to);
CREATE INDEX IF NOT EXISTS idx_client_resumes_client_id ON public.client_resumes(client_id);
CREATE INDEX IF NOT EXISTS idx_internship_records_client_id ON public.internship_records(client_id);
CREATE INDEX IF NOT EXISTS idx_admin_notes_client_id ON public.admin_notes(client_id);

-- Create function for client progress tracking
CREATE OR REPLACE FUNCTION public.get_client_progress(client_uuid UUID)
RETURNS TABLE(
  total_days INTEGER,
  days_with_updates INTEGER,
  total_applications INTEGER,
  interviews_scheduled INTEGER,
  courses_completed INTEGER,
  completion_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  program_start DATE;
  days_elapsed INTEGER;
BEGIN
  -- Get program start date
  SELECT program_start_date INTO program_start
  FROM public.user_profiles
  WHERE id = client_uuid;
  
  -- Calculate days elapsed
  days_elapsed := COALESCE(EXTRACT(DAY FROM (CURRENT_DATE - program_start))::INTEGER, 0);
  
  RETURN QUERY
  SELECT 
    GREATEST(days_elapsed, 0) as total_days,
    (SELECT COUNT(*)::INTEGER FROM public.daily_updates WHERE client_id = client_uuid) as days_with_updates,
    (SELECT COUNT(*)::INTEGER FROM public.job_applications WHERE client_id = client_uuid) as total_applications,
    (SELECT COUNT(*)::INTEGER FROM public.interviews i 
     JOIN public.job_applications ja ON i.job_application_id = ja.id 
     WHERE ja.client_id = client_uuid) as interviews_scheduled,
    (SELECT COUNT(*)::INTEGER FROM public.course_materials WHERE assigned_to = client_uuid AND is_completed = true) as courses_completed,
    CASE 
      WHEN days_elapsed > 0 THEN 
        ROUND(((SELECT COUNT(*) FROM public.daily_updates WHERE client_id = client_uuid)::NUMERIC / days_elapsed::NUMERIC) * 100, 2)
      ELSE 0 
    END as completion_percentage;
END;
$$;

-- Create storage bucket for file uploads if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('client-files', 'client-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
DO $$ 
BEGIN
    -- Create policy for file uploads
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Users can upload their own files'
    ) THEN
        CREATE POLICY "Users can upload their own files" ON storage.objects
        FOR INSERT WITH CHECK (
            bucket_id = 'client-files' AND
            (auth.uid()::text = (storage.foldername(name))[1] OR
             EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin'))
        );
    END IF;

    -- Create policy for viewing files
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Users can view files'
    ) THEN
        CREATE POLICY "Users can view files" ON storage.objects
        FOR SELECT USING (
            bucket_id = 'client-files' AND
            (auth.uid()::text = (storage.foldername(name))[1] OR
             EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin'))
        );
    END IF;

    -- Create policy for deleting files
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND policyname = 'Users can delete their own files'
    ) THEN
        CREATE POLICY "Users can delete their own files" ON storage.objects
        FOR DELETE USING (
            bucket_id = 'client-files' AND
            (auth.uid()::text = (storage.foldername(name))[1] OR
             EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin'))
        );
    END IF;
END $$;
;
