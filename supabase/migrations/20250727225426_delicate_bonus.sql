\n\n-- Only create the Edge Function for manual referral code generation if needed\n-- The existing database triggers will handle automatic assignment\n\n-- Drop any duplicate triggers/functions if they exist to prevent conflicts\nDROP TRIGGER IF EXISTS trigger_auto_assign_referral_code ON public.user_profiles;
\nDROP FUNCTION IF EXISTS auto_assign_referral_code();
\n\n-- The referral_code column and existing triggers are already in place\n-- No additional database changes needed;
