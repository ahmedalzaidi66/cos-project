/*
  # Upgrade admin loyalty adjustment function and add tier override function

  ## Summary
  1. Drops and recreates adjust_loyalty_points_admin with renamed param p_note→p_reason
     and proper admin_add/admin_subtract transaction types
  2. Creates admin_set_loyalty_tier for manual tier override management
  Both are SECURITY DEFINER, safe for service-role callers.
*/

-- ── 1. Drop old function (param rename requires drop) ────────────────────────
DROP FUNCTION IF EXISTS public.adjust_loyalty_points_admin(uuid, uuid, integer, text);

-- ── 2. Recreate with improved logic ──────────────────────────────────────────
CREATE FUNCTION public.adjust_loyalty_points_admin(
  p_admin_id  uuid,
  p_user_id   uuid,
  p_delta     integer,
  p_reason    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_loyalty     record;
  v_new_total   integer;
  v_txn_type    text;
  v_safe_admin  uuid;
BEGIN
  IF p_delta = 0 THEN
    RETURN jsonb_build_object('error', 'delta_cannot_be_zero');
  END IF;

  v_txn_type := CASE WHEN p_delta > 0 THEN 'admin_add' ELSE 'admin_subtract' END;

  -- Only store admin_id FK if that UUID actually exists in auth.users
  SELECT id INTO v_safe_admin FROM auth.users WHERE id = p_admin_id LIMIT 1;

  SELECT * INTO v_loyalty FROM customer_loyalty WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO customer_loyalty (user_id, total_points, lifetime_points, pending_points, tier)
    VALUES (p_user_id, GREATEST(0, p_delta), GREATEST(0, p_delta), 0, 'bronze')
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_loyalty FROM customer_loyalty WHERE user_id = p_user_id FOR UPDATE;
  END IF;

  v_new_total := GREATEST(0, v_loyalty.total_points + p_delta);

  UPDATE customer_loyalty
  SET
    total_points    = v_new_total,
    lifetime_points = CASE WHEN p_delta > 0 THEN lifetime_points + p_delta ELSE lifetime_points END,
    updated_at      = now()
  WHERE user_id = p_user_id;

  INSERT INTO loyalty_transactions
    (user_id, type, points, balance_after, status, note, description, admin_id)
  VALUES (
    p_user_id,
    v_txn_type,
    p_delta,
    v_new_total,
    'confirmed',
    COALESCE(p_reason, 'Admin adjustment'),
    CASE
      WHEN p_delta > 0 THEN 'Admin added ' || p_delta || ' points'
      ELSE 'Admin removed ' || ABS(p_delta) || ' points'
    END,
    v_safe_admin
  );

  RETURN jsonb_build_object(
    'success',     true,
    'delta',       p_delta,
    'new_balance', v_new_total,
    'type',        v_txn_type
  );
END;
$$;

-- ── 3. Create admin_set_loyalty_tier ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_loyalty_tier(
  p_admin_id         uuid,
  p_user_id          uuid,
  p_tier             text,
  p_reason           text DEFAULT NULL,
  p_override_enabled boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_loyalty      record;
  v_auto_tier    text;
  v_final_tier   text;
  v_safe_admin   uuid;
BEGIN
  IF p_tier IS NOT NULL AND p_tier NOT IN ('bronze', 'silver', 'gold', 'platinum') THEN
    RETURN jsonb_build_object('error', 'invalid_tier', 'value', p_tier);
  END IF;

  SELECT id INTO v_safe_admin FROM auth.users WHERE id = p_admin_id LIMIT 1;

  SELECT * INTO v_loyalty FROM customer_loyalty WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO customer_loyalty (user_id, total_points, lifetime_points, pending_points, tier)
    VALUES (p_user_id, 0, 0, 0, 'bronze')
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_loyalty FROM customer_loyalty WHERE user_id = p_user_id FOR UPDATE;
  END IF;

  v_auto_tier := CASE
    WHEN v_loyalty.lifetime_points >= 15000 THEN 'platinum'
    WHEN v_loyalty.lifetime_points >= 5000  THEN 'gold'
    WHEN v_loyalty.lifetime_points >= 2000  THEN 'silver'
    ELSE 'bronze'
  END;

  IF p_override_enabled THEN
    v_final_tier := COALESCE(p_tier, v_auto_tier);
    UPDATE customer_loyalty
    SET
      tier                     = v_final_tier,
      tier_override_enabled    = true,
      override_tier            = v_final_tier,
      tier_override_reason     = COALESCE(p_reason, 'Manual override by admin'),
      tier_override_updated_by = v_safe_admin,
      tier_override_updated_at = now(),
      updated_at               = now()
    WHERE user_id = p_user_id;
  ELSE
    v_final_tier := v_auto_tier;
    UPDATE customer_loyalty
    SET
      tier                     = v_auto_tier,
      tier_override_enabled    = false,
      override_tier            = NULL,
      tier_override_reason     = NULL,
      tier_override_updated_by = v_safe_admin,
      tier_override_updated_at = now(),
      updated_at               = now()
    WHERE user_id = p_user_id;
  END IF;

  INSERT INTO loyalty_transactions
    (user_id, type, points, balance_after, status, note, description, admin_id)
  VALUES (
    p_user_id,
    'adjust',
    0,
    v_loyalty.total_points,
    'confirmed',
    COALESCE(p_reason, 'Tier override by admin'),
    CASE
      WHEN p_override_enabled THEN 'Tier manually set to ' || v_final_tier
      ELSE 'Tier override removed — auto tier: ' || v_auto_tier
    END,
    v_safe_admin
  );

  RETURN jsonb_build_object(
    'success',               true,
    'tier',                  v_final_tier,
    'tier_override_enabled', p_override_enabled,
    'auto_tier',             v_auto_tier
  );
END;
$$;
