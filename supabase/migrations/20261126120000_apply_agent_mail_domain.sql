-- Job addresses move to their own domain, primoboostjobs.in: mail for any
-- address there goes to the apply-mail-inbound function (Cloudflare catch-all),
-- and primoboostai.in keeps its Hostinger mail. No mail was ever delivered to
-- the old @apply.primoboostai.in addresses, so they are changed in place.

UPDATE apply_agents
SET address = replace(address, '@apply.primoboostai.in', '@primoboostjobs.in')
WHERE address LIKE '%@apply.primoboostai.in';

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
    VALUES (v_user, 'apply-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) || '@primoboostjobs.in')
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
