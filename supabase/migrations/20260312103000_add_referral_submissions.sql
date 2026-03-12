/*
  # Add referral submissions

  1. New table
    - `referral_submissions`
      - Stores the paid referral request submitted by the client
      - Links the request to the referral listing and payment transaction
      - Stores the contact email and uploaded resume PDF path

  2. Security
    - Users can view and insert their own submissions
    - Admins can view and update all submissions
*/

CREATE TABLE IF NOT EXISTS public.referral_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_listing_id uuid NOT NULL REFERENCES public.referral_listings(id) ON DELETE CASCADE,
  payment_transaction_id uuid NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  applicant_name text NOT NULL DEFAULT '',
  contact_email text NOT NULL,
  resume_file_name text NOT NULL,
  resume_storage_path text NOT NULL,
  amount_paid integer NOT NULL DEFAULT 0,
  admin_notified_at timestamptz,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'processing', 'completed', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_submissions_payment_transaction_id_key UNIQUE (payment_transaction_id)
);

ALTER TABLE public.referral_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral submissions"
  ON public.referral_submissions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own referral submissions"
  ON public.referral_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins can view all referral submissions"
  ON public.referral_submissions
  FOR SELECT
  TO authenticated
  USING (is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can update all referral submissions"
  ON public.referral_submissions
  FOR UPDATE
  TO authenticated
  USING (is_admin((SELECT auth.uid())))
  WITH CHECK (is_admin((SELECT auth.uid())));

CREATE INDEX IF NOT EXISTS idx_referral_submissions_user_id
  ON public.referral_submissions(user_id);

CREATE INDEX IF NOT EXISTS idx_referral_submissions_listing_id
  ON public.referral_submissions(referral_listing_id);

CREATE INDEX IF NOT EXISTS idx_referral_submissions_created_at
  ON public.referral_submissions(created_at DESC);
