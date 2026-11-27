/*
  # The apply agent: the user's agreement, and an address for job mail

  One row in apply_agents is the user's agreement that we may apply in their
  name. With it comes an address used on application forms, so that codes and
  replies reach us without any access to the user's own mailbox.

  Turning the agent off stops new applications. Replies to the address are
  still kept and forwarded, because employers go on writing to it.
*/

CREATE TABLE IF NOT EXISTS apply_agents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  address text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  agreed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE apply_agents ENABLE ROW LEVEL SECURITY;
-- Read only: the address and the agreement are written by the functions below.
DROP POLICY IF EXISTS "Users read their own agent" ON apply_agents;
CREATE POLICY "Users read their own agent" ON apply_agents FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS apply_mail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id uuid REFERENCES auto_apply_applications(id) ON DELETE SET NULL,
  message_id text NOT NULL,
  from_address text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  kind text NOT NULL CHECK (kind IN ('code', 'confirmed', 'interview', 'rejected', 'other')),
  forwarded boolean NOT NULL DEFAULT false,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);
CREATE INDEX IF NOT EXISTS apply_mail_by_user ON apply_mail (user_id, received_at DESC);
ALTER TABLE apply_mail ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their own job mail" ON apply_mail;
CREATE POLICY "Users read their own job mail" ON apply_mail FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users delete their own job mail" ON apply_mail;
CREATE POLICY "Users delete their own job mail" ON apply_mail FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Turns the agent on or off for the caller. The address never changes once given.
CREATE OR REPLACE FUNCTION set_apply_agent(p_active boolean)
RETURNS apply_agents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row apply_agents;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_active THEN
    INSERT INTO apply_agents (user_id, address)
    VALUES (v_user, 'apply-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) || '@apply.primoboostai.in')
    ON CONFLICT (user_id) DO UPDATE
      SET active = true,
          agreed_at = CASE WHEN apply_agents.active THEN apply_agents.agreed_at ELSE now() END
    RETURNING * INTO v_row;
  ELSE
    UPDATE apply_agents SET active = false WHERE user_id = v_user RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION set_apply_agent(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_apply_agent(boolean) TO authenticated;
