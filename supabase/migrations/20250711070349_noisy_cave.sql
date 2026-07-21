\n\n-- Add username column to user_profiles table\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'user_profiles' AND column_name = 'username'\n  ) THEN\n    ALTER TABLE user_profiles ADD COLUMN username text;
\n  END IF;
\nEND $$;
\n\n-- Add unique constraint on username\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.table_constraints\n    WHERE table_name = 'user_profiles' AND constraint_name = 'user_profiles_username_key'\n  ) THEN\n    ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_username_key UNIQUE (username);
\n  END IF;
\nEND $$;
\n\n-- Add index for username lookups\nCREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles (username);
\n\n-- Update RLS policies to allow username access (policies already exist, this ensures they work with username)\n-- The existing policies should already cover username access since they allow users to read/update their own profiles;
