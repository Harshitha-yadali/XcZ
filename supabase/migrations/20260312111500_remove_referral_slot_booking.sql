/*
  # Remove referral slot booking

  1. Changes
    - Drops the obsolete referral slot booking table because the referral flow
      now uses direct payment plus email/PDF submission instead of time slots.
*/

DROP TABLE IF EXISTS public.referral_consultation_slots CASCADE;
