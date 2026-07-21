\n\n-- Add job_listing_id column to job_applications table\nALTER TABLE public.job_applications\nADD COLUMN IF NOT EXISTS job_listing_id TEXT;
\n\n-- Add an index for faster lookups\nCREATE INDEX IF NOT EXISTS idx_job_applications_job_listing_id \nON public.job_applications (job_listing_id);
\n\n-- Add a comment to document the column purpose\nCOMMENT ON COLUMN public.job_applications.job_listing_id IS 'Unique identifier for the job listing (e.g., frontend-developer-intern)';
;
