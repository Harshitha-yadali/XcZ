-- Consume any supported credit type in one database transaction.
-- Add-on balances are used first, followed by active plan balances.
CREATE OR REPLACE FUNCTION public.consume_user_credits(
  p_credit_type text,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_available integer := 0;
  v_to_consume integer := p_quantity;
  v_take integer := 0;
  v_addon record;
  v_subscription record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 100 THEN
    RETURN jsonb_build_object(
      'success', false,
      'remaining', 0,
      'error', 'Invalid credit quantity.'
    );
  END IF;

  IF p_credit_type NOT IN ('optimization', 'score_check', 'linkedin_messages', 'guided_build') THEN
    RETURN jsonb_build_object(
      'success', false,
      'remaining', 0,
      'error', 'Invalid credit type.'
    );
  END IF;

  -- Lock every applicable row before checking the combined balance. This keeps
  -- concurrent runs from observing and spending the same credits.
  FOR v_addon IN
    SELECT credits.id, GREATEST(0, COALESCE(credits.quantity_remaining, 0))::integer AS remaining
    FROM public.user_addon_credits AS credits
    JOIN public.addon_types AS types ON types.id = credits.addon_type_id
    WHERE credits.user_id = v_user_id
      AND types.type_key = p_credit_type
      AND COALESCE(credits.quantity_remaining, 0) > 0
    ORDER BY credits.purchased_at ASC, credits.id ASC
    FOR UPDATE OF credits
  LOOP
    v_available := v_available + v_addon.remaining;
  END LOOP;

  FOR v_subscription IN
    SELECT
      subscriptions.id,
      CASE p_credit_type
        WHEN 'optimization' THEN COALESCE(subscriptions.optimizations_total, 0)
        WHEN 'score_check' THEN COALESCE(subscriptions.score_checks_total, 0)
        WHEN 'linkedin_messages' THEN COALESCE(subscriptions.linkedin_messages_total, 0)
        WHEN 'guided_build' THEN COALESCE(subscriptions.guided_builds_total, 0)
      END::integer AS total,
      CASE p_credit_type
        WHEN 'optimization' THEN COALESCE(subscriptions.optimizations_used, 0)
        WHEN 'score_check' THEN COALESCE(subscriptions.score_checks_used, 0)
        WHEN 'linkedin_messages' THEN COALESCE(subscriptions.linkedin_messages_used, 0)
        WHEN 'guided_build' THEN COALESCE(subscriptions.guided_builds_used, 0)
      END::integer AS used
    FROM public.subscriptions AS subscriptions
    WHERE subscriptions.user_id = v_user_id
      AND subscriptions.status = 'active'
    ORDER BY subscriptions.created_at ASC, subscriptions.id ASC
    FOR UPDATE OF subscriptions
  LOOP
    v_available := v_available + GREATEST(0, v_subscription.total - v_subscription.used);
  END LOOP;

  IF v_available < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'remaining', v_available,
      'error', format(
        'This action requires %s credit%s, but only %s are available.',
        p_quantity,
        CASE WHEN p_quantity = 1 THEN '' ELSE 's' END,
        v_available
      )
    );
  END IF;

  FOR v_addon IN
    SELECT credits.id, GREATEST(0, COALESCE(credits.quantity_remaining, 0))::integer AS remaining
    FROM public.user_addon_credits AS credits
    JOIN public.addon_types AS types ON types.id = credits.addon_type_id
    WHERE credits.user_id = v_user_id
      AND types.type_key = p_credit_type
      AND COALESCE(credits.quantity_remaining, 0) > 0
    ORDER BY credits.purchased_at ASC, credits.id ASC
  LOOP
    EXIT WHEN v_to_consume = 0;
    v_take := LEAST(v_to_consume, v_addon.remaining);
    UPDATE public.user_addon_credits
    SET quantity_remaining = quantity_remaining - v_take
    WHERE id = v_addon.id AND user_id = v_user_id;
    v_to_consume := v_to_consume - v_take;
  END LOOP;

  FOR v_subscription IN
    SELECT
      subscriptions.id,
      CASE p_credit_type
        WHEN 'optimization' THEN COALESCE(subscriptions.optimizations_total, 0)
        WHEN 'score_check' THEN COALESCE(subscriptions.score_checks_total, 0)
        WHEN 'linkedin_messages' THEN COALESCE(subscriptions.linkedin_messages_total, 0)
        WHEN 'guided_build' THEN COALESCE(subscriptions.guided_builds_total, 0)
      END::integer AS total,
      CASE p_credit_type
        WHEN 'optimization' THEN COALESCE(subscriptions.optimizations_used, 0)
        WHEN 'score_check' THEN COALESCE(subscriptions.score_checks_used, 0)
        WHEN 'linkedin_messages' THEN COALESCE(subscriptions.linkedin_messages_used, 0)
        WHEN 'guided_build' THEN COALESCE(subscriptions.guided_builds_used, 0)
      END::integer AS used
    FROM public.subscriptions AS subscriptions
    WHERE subscriptions.user_id = v_user_id
      AND subscriptions.status = 'active'
    ORDER BY subscriptions.created_at ASC, subscriptions.id ASC
  LOOP
    EXIT WHEN v_to_consume = 0;
    v_take := LEAST(v_to_consume, GREATEST(0, v_subscription.total - v_subscription.used));
    CONTINUE WHEN v_take = 0;

    CASE p_credit_type
      WHEN 'optimization' THEN
        UPDATE public.subscriptions
        SET optimizations_used = COALESCE(optimizations_used, 0) + v_take, updated_at = now()
        WHERE id = v_subscription.id AND user_id = v_user_id;
      WHEN 'score_check' THEN
        UPDATE public.subscriptions
        SET score_checks_used = COALESCE(score_checks_used, 0) + v_take, updated_at = now()
        WHERE id = v_subscription.id AND user_id = v_user_id;
      WHEN 'linkedin_messages' THEN
        UPDATE public.subscriptions
        SET linkedin_messages_used = COALESCE(linkedin_messages_used, 0) + v_take, updated_at = now()
        WHERE id = v_subscription.id AND user_id = v_user_id;
      WHEN 'guided_build' THEN
        UPDATE public.subscriptions
        SET guided_builds_used = COALESCE(guided_builds_used, 0) + v_take, updated_at = now()
        WHERE id = v_subscription.id AND user_id = v_user_id;
    END CASE;

    v_to_consume := v_to_consume - v_take;
  END LOOP;

  IF v_to_consume <> 0 THEN
    RAISE EXCEPTION 'Credit consumption invariant failed';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'remaining', v_available - p_quantity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_user_credits(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_user_credits(text, integer) TO authenticated;

COMMENT ON FUNCTION public.consume_user_credits(text, integer) IS
  'Atomically consumes add-on and plan credits for the authenticated user.';
