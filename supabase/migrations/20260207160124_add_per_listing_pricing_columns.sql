/*\n  # Add per-listing pricing columns to referral_listings\n\n  1. Modified Tables\n    - `referral_listings`\n      - `query_price` (integer, nullable) - Per-listing referral query price in paise, overrides global pricing\n      - `profile_price` (integer, nullable) - Per-listing profile monetization price in paise, overrides global pricing\n      - `slot_price` (integer, nullable) - Per-listing consultation slot price in paise, overrides global pricing\n\n  2. Notes\n    - All price columns are nullable;
 when null, the global pricing from referral_pricing table is used\n    - Prices are stored in paise (1 INR = 100 paise) for consistency with referral_pricing table\n*/\n\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'referral_listings' AND column_name = 'query_price'\n  ) THEN\n    ALTER TABLE referral_listings ADD COLUMN query_price integer;
\n  END IF;
\n\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'referral_listings' AND column_name = 'profile_price'\n  ) THEN\n    ALTER TABLE referral_listings ADD COLUMN profile_price integer;
\n  END IF;
\n\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'referral_listings' AND column_name = 'slot_price'\n  ) THEN\n    ALTER TABLE referral_listings ADD COLUMN slot_price integer;
\n  END IF;
\nEND $$;
;
