\n\n-- Add the profile prompt tracking column\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'user_profiles' AND column_name = 'has_seen_profile_prompt'\n  ) THEN\n    ALTER TABLE user_profiles ADD COLUMN has_seen_profile_prompt boolean DEFAULT FALSE NOT NULL;
\n  END IF;
\nEND $$;
\n\n-- Update existing users to have not seen the prompt (they can see it once)\nUPDATE user_profiles SET has_seen_profile_prompt = FALSE WHERE has_seen_profile_prompt IS NULL;
\n\n-- Add index for performance\nCREATE INDEX IF NOT EXISTS idx_user_profiles_profile_prompt ON user_profiles(has_seen_profile_prompt);
;
