/*
  # Site logins for auto-apply

  Some job sites only take applications from a signed-in account. The user
  gives us their login for that site once; it is kept here, with the password
  encrypted by an edge function (see _shared/vault.ts). `platform` holds the
  hostname of the job site.

  Only edge functions read or write this table, through the service role.
  Any policy that let signed-in users reach it directly is removed, so the
  browser can never read a stored password, even in encrypted form.
*/

CREATE TABLE IF NOT EXISTS user_credentials_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL,
  username text,
  password_encrypted text,
  oauth_token text,
  token_expiry timestamptz,
  cookies jsonb DEFAULT '{}'::jsonb,
  is_verified boolean DEFAULT false,
  last_used timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, platform)
);

ALTER TABLE user_credentials_vault ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing record;
BEGIN
  FOR existing IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_credentials_vault'
  LOOP
    EXECUTE format('DROP POLICY %I ON user_credentials_vault', existing.policyname);
  END LOOP;
END $$;
