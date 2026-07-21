/*\n  # Fix referral listing cascade delete\n\n  1. Changes\n    - Drop and recreate foreign key on `referral_purchases.referral_listing_id` with ON DELETE CASCADE\n    - Drop and recreate foreign key on `referral_consultation_slots.referral_listing_id` with ON DELETE CASCADE\n\n  2. Notes\n    - This allows deleting a referral listing to automatically remove all related purchases and slot bookings\n    - Prevents the 409 foreign key constraint violation when admin deletes a listing\n*/\n\nDO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1 FROM information_schema.table_constraints\n    WHERE constraint_name = 'referral_purchases_referral_listing_id_fkey'\n    AND table_name = 'referral_purchases'\n  ) THEN\n    ALTER TABLE referral_purchases DROP CONSTRAINT referral_purchases_referral_listing_id_fkey;
\n  END IF;
\n\n  ALTER TABLE referral_purchases\n    ADD CONSTRAINT referral_purchases_referral_listing_id_fkey\n    FOREIGN KEY (referral_listing_id) REFERENCES referral_listings(id) ON DELETE CASCADE;
\n\n  IF EXISTS (\n    SELECT 1 FROM information_schema.table_constraints\n    WHERE constraint_name = 'referral_consultation_slots_referral_listing_id_fkey'\n    AND table_name = 'referral_consultation_slots'\n  ) THEN\n    ALTER TABLE referral_consultation_slots DROP CONSTRAINT referral_consultation_slots_referral_listing_id_fkey;
\n  END IF;
\n\n  ALTER TABLE referral_consultation_slots\n    ADD CONSTRAINT referral_consultation_slots_referral_listing_id_fkey\n    FOREIGN KEY (referral_listing_id) REFERENCES referral_listings(id) ON DELETE CASCADE;
\nEND $$;
;
