/*
  # Lock down user-writable rows that grant privileges, credits, or money

  Problem (VAPT 2026-09-19):
  - user_profiles: "Users can update own profile" had no column limits, so any
    user could set role = 'admin' (is_admin() reads this column) or rewrite
    referred_by to farm referral signup bonuses.
  - subscriptions / user_addon_credits: users could insert or update their own
    rows directly, e.g. optimizations_total = 99999.
  - wallet_transactions: INSERT TO authenticated WITH CHECK (true) let any
    user mint wallet balance and spend it at checkout.
  - webinar_registrations: users could mark their own registration paid.
  - job_fetch_configs / job_sync_logs: admin policies trusted
    raw_user_meta_data.role, which users can set via auth.updateUser().

  Fix:
  - Triggers reject privileged changes when the caller is a plain API user
    (current_user authenticated/anon). Service-role edge functions and
    SECURITY DEFINER functions run as other roles and are unaffected; admins
    (is_admin) are also exempt.
  - The browser still decrements its own credits, so usage counters may move
    only in the "spend" direction.
  - Drop the direct INSERT paths that are never needed from the browser.
*/

-- True when the statement comes straight from a PostgREST user session.
CREATE OR REPLACE FUNCTION public.is_restricted_api_caller()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT current_user IN ('authenticated', 'anon')
     AND NOT COALESCE(public.is_admin(auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- user_profiles: role and referred_by are server-managed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_user_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_restricted_api_caller() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'client';
    NEW.referred_by := NULL;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
    RAISE EXCEPTION 'role and referred_by cannot be changed by users'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_profile_privileged_columns ON public.user_profiles;
CREATE TRIGGER guard_user_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_profile_privileged_columns();

-- ---------------------------------------------------------------------------
-- subscriptions: users may only increase *_used counters
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create own subscriptions" ON public.subscriptions;

CREATE OR REPLACE FUNCTION public.guard_subscription_user_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  col record;
  old_row jsonb := to_jsonb(OLD);
BEGIN
  IF NOT public.is_restricted_api_caller() THEN
    RETURN NEW;
  END IF;

  FOR col IN SELECT key, value FROM jsonb_each(to_jsonb(NEW)) LOOP
    CONTINUE WHEN col.key = 'updated_at';
    CONTINUE WHEN col.value IS NOT DISTINCT FROM old_row -> col.key;

    IF col.key LIKE '%\_used'
       AND jsonb_typeof(col.value) = 'number'
       AND (col.value #>> '{}')::numeric >= COALESCE((old_row ->> col.key)::numeric, 0) THEN
      CONTINUE;
    END IF;

    RAISE EXCEPTION 'subscriptions.% cannot be changed by users', col.key
      USING ERRCODE = '42501';
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_subscription_user_update ON public.subscriptions;
CREATE TRIGGER guard_subscription_user_update
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_user_update();

-- ---------------------------------------------------------------------------
-- user_addon_credits: users may only decrease quantity_remaining
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_addon_credit_user_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_restricted_api_caller() THEN
    RETURN NEW;
  END IF;

  IF (to_jsonb(NEW) - ARRAY['quantity_remaining', 'updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['quantity_remaining', 'updated_at'])
     OR NEW.quantity_remaining > OLD.quantity_remaining
     OR NEW.quantity_remaining < 0 THEN
    RAISE EXCEPTION 'add-on credits can only be spent by users'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_addon_credit_user_update ON public.user_addon_credits;
CREATE TRIGGER guard_addon_credit_user_update
  BEFORE UPDATE ON public.user_addon_credits
  FOR EACH ROW EXECUTE FUNCTION public.guard_addon_credit_user_update();

-- ---------------------------------------------------------------------------
-- wallet_transactions: only server code (service role / SECURITY DEFINER
-- referral triggers) writes wallet rows
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "System can insert transactions" ON public.wallet_transactions;

-- ---------------------------------------------------------------------------
-- webinar_registrations: payment state is set by verify-payment / webhook
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_webinar_registration_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_restricted_api_caller() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.payment_status := 'pending';
    NEW.registration_status := 'pending';
    NEW.payment_transaction_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.registration_status IS DISTINCT FROM OLD.registration_status
     OR NEW.payment_transaction_id IS DISTINCT FROM OLD.payment_transaction_id THEN
    RAISE EXCEPTION 'webinar payment status cannot be changed by users'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_webinar_registration_payment ON public.webinar_registrations;
CREATE TRIGGER guard_webinar_registration_payment
  BEFORE INSERT OR UPDATE ON public.webinar_registrations
  FOR EACH ROW EXECUTE FUNCTION public.guard_webinar_registration_payment();

-- ---------------------------------------------------------------------------
-- job_fetch_configs / job_sync_logs: stop trusting user-editable metadata
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all job fetch configs" ON public.job_fetch_configs;
DROP POLICY IF EXISTS "Admins can insert job fetch configs" ON public.job_fetch_configs;
DROP POLICY IF EXISTS "Admins can update job fetch configs" ON public.job_fetch_configs;
DROP POLICY IF EXISTS "Admins can delete job fetch configs" ON public.job_fetch_configs;

CREATE POLICY "Admins can view all job fetch configs"
  ON public.job_fetch_configs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert job fetch configs"
  ON public.job_fetch_configs FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update job fetch configs"
  ON public.job_fetch_configs FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete job fetch configs"
  ON public.job_fetch_configs FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all job sync logs" ON public.job_sync_logs;
CREATE POLICY "Admins can view all job sync logs"
  ON public.job_sync_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
