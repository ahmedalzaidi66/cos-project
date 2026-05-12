/*
  # Fix loyalty_settings missing columns and award function

  ## Problem
  The `award_loyalty_points_for_order` function references columns that do not
  exist on the `loyalty_settings` table:
    - `earning_enabled`   → table has `is_active`
    - `min_order_to_earn` → table had no equivalent
    - `iqd_per_point`     → table has `points_value` (IQD value of 1 point)
    - `points_per_iqd`    → table has `points_per_order_unit` (points per 1000 IQD)

  This caused "record v_settings has no field earning_enabled" whenever an order
  was set to Delivered or Completed, blocking the status update entirely.

  ## Changes
  1. Add missing columns to `loyalty_settings` with safe defaults
     - `earning_enabled`   BOOLEAN DEFAULT true
     - `redeem_enabled`    BOOLEAN DEFAULT true
     - `point_conversion_rate` NUMERIC DEFAULT 1.0  (points per IQD, derived from existing data)
     - `minimum_redeem_amount` NUMERIC DEFAULT 0
     - `max_redeem_percentage` NUMERIC DEFAULT 100
     - `minimum_order_amount`  NUMERIC DEFAULT 0
  2. Backfill row id=1 from existing columns so live data is preserved
  3. Replace `award_loyalty_points_for_order` to use correct column names
     with safe COALESCE fallbacks so it never crashes even if settings are absent
*/

-- ── 1. Add missing columns ────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_settings' AND column_name = 'earning_enabled'
  ) THEN
    ALTER TABLE loyalty_settings ADD COLUMN earning_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_settings' AND column_name = 'redeem_enabled'
  ) THEN
    ALTER TABLE loyalty_settings ADD COLUMN redeem_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_settings' AND column_name = 'point_conversion_rate'
  ) THEN
    -- points per IQD: existing points_per_order_unit = points per 1000 IQD
    ALTER TABLE loyalty_settings ADD COLUMN point_conversion_rate NUMERIC(10,6) NOT NULL DEFAULT 1.0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_settings' AND column_name = 'minimum_redeem_amount'
  ) THEN
    ALTER TABLE loyalty_settings ADD COLUMN minimum_redeem_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_settings' AND column_name = 'max_redeem_percentage'
  ) THEN
    ALTER TABLE loyalty_settings ADD COLUMN max_redeem_percentage NUMERIC(5,2) NOT NULL DEFAULT 100;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_settings' AND column_name = 'minimum_order_amount'
  ) THEN
    ALTER TABLE loyalty_settings ADD COLUMN minimum_order_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── 2. Backfill row id=1 from existing data ───────────────────────────────────
-- points_per_order_unit = 1000 means 1000 points per 1000 IQD = 1 point/IQD
UPDATE loyalty_settings
SET
  earning_enabled       = is_active,
  redeem_enabled        = is_active,
  point_conversion_rate = CASE
                            WHEN points_per_order_unit > 0
                            THEN points_per_order_unit::numeric / 1000.0
                            ELSE 1.0
                          END,
  minimum_redeem_amount = 0,
  max_redeem_percentage = 100,
  minimum_order_amount  = 0
WHERE id = 1;

-- ── 3. Replace award function to use correct column names ─────────────────────
CREATE OR REPLACE FUNCTION public.award_loyalty_points_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order           record;
  v_settings        record;
  v_loyalty         record;
  v_user_id         uuid;
  v_iqd_per_point   numeric;
  v_points_per_iqd  numeric;
  v_earnable        numeric;
  v_points_to_award integer;
  v_new_total       integer;
  v_new_lifetime    integer;
  v_new_pending     integer;
  v_old_tier        text;
  v_new_tier        text;
BEGIN
  -- Fetch order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'order_not_found');
  END IF;

  -- Only award on delivered
  IF v_order.status <> 'delivered' THEN
    RETURN jsonb_build_object('error', 'not_delivered', 'status', v_order.status);
  END IF;

  -- Idempotency guard
  IF COALESCE(v_order.points_earned, 0) > 0 THEN
    RETURN jsonb_build_object('message', 'already_awarded', 'points', v_order.points_earned);
  END IF;

  -- Load settings with safe fallback if row missing
  SELECT * INTO v_settings FROM loyalty_settings WHERE id = 1;
  IF NOT FOUND THEN
    -- Use safe defaults: 1 point per IQD, no minimum, earning on
    v_iqd_per_point  := 1.0;
    v_points_per_iqd := 1.0;
  ELSE
    -- earning_enabled: prefer new column, fall back to is_active
    IF NOT COALESCE(v_settings.earning_enabled, v_settings.is_active, true) THEN
      RETURN jsonb_build_object('message', 'earning_disabled');
    END IF;

    -- Minimum order check — use minimum_order_amount (default 0 = no minimum)
    IF v_order.total < COALESCE(v_settings.minimum_order_amount, 0) THEN
      UPDATE orders SET points_earned = 0 WHERE id = p_order_id;
      RETURN jsonb_build_object('message', 'below_minimum');
    END IF;

    -- IQD value of 1 point: use points_value (e.g. 100 IQD per point)
    v_iqd_per_point := COALESCE(v_settings.points_value, 100);

    -- Points earned per IQD: derived from point_conversion_rate or points_per_order_unit
    -- point_conversion_rate is points per IQD directly
    -- points_per_order_unit is points per 1000 IQD
    v_points_per_iqd := COALESCE(
      v_settings.point_conversion_rate,
      CASE WHEN COALESCE(v_settings.points_per_order_unit, 0) > 0
           THEN v_settings.points_per_order_unit::numeric / 1000.0
           ELSE 1.0
      END
    );
  END IF;

  -- Resolve user_id from order or customer email
  v_user_id := v_order.user_id;
  IF v_user_id IS NULL THEN
    SELECT auth_user_id INTO v_user_id
    FROM customers
    WHERE email = v_order.customer_email
    LIMIT 1;
  END IF;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('message', 'no_auth_user');
  END IF;

  -- Calculate earnable total (subtract value of redeemed points)
  v_earnable := GREATEST(
    0,
    v_order.total - (COALESCE(v_order.points_redeemed, 0) * v_iqd_per_point)
  );
  v_points_to_award := FLOOR(v_earnable * v_points_per_iqd)::integer;

  IF v_points_to_award <= 0 THEN
    UPDATE orders SET points_earned = 0 WHERE id = p_order_id;
    RETURN jsonb_build_object('message', 'no_points_to_award');
  END IF;

  -- Upsert customer_loyalty
  SELECT * INTO v_loyalty FROM customer_loyalty WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    v_new_total    := v_points_to_award;
    v_new_lifetime := v_points_to_award;
    v_new_pending  := 0;
    v_old_tier     := 'bronze';
  ELSE
    v_new_total    := COALESCE(v_loyalty.total_points, 0) + v_points_to_award;
    v_new_lifetime := COALESCE(v_loyalty.lifetime_points, 0) + v_points_to_award;
    v_new_pending  := GREATEST(0, COALESCE(v_loyalty.pending_points, 0) - v_points_to_award);
    v_old_tier     := COALESCE(v_loyalty.tier, 'bronze');
  END IF;

  -- Compute tier from lifetime points
  v_new_tier := CASE
    WHEN v_new_lifetime >= 15000 THEN 'platinum'
    WHEN v_new_lifetime >= 5000  THEN 'gold'
    WHEN v_new_lifetime >= 2000  THEN 'silver'
    ELSE 'bronze'
  END;

  INSERT INTO customer_loyalty (user_id, total_points, lifetime_points, pending_points, tier, updated_at)
  VALUES (v_user_id, v_new_total, v_new_lifetime, v_new_pending, v_new_tier, now())
  ON CONFLICT (user_id) DO UPDATE SET
    total_points    = EXCLUDED.total_points,
    lifetime_points = EXCLUDED.lifetime_points,
    pending_points  = EXCLUDED.pending_points,
    tier            = EXCLUDED.tier,
    updated_at      = now();

  -- Insert earn transaction
  INSERT INTO loyalty_transactions (user_id, order_id, type, points, balance_after, status, note, description)
  VALUES (
    v_user_id, p_order_id, 'earn', v_points_to_award, v_new_total,
    'confirmed',
    'Order #' || upper(substring(p_order_id::text, 1, 8)) || ' delivered',
    'Points earned from completed order'
  );

  -- Update order with awarded points
  UPDATE orders SET points_earned = v_points_to_award WHERE id = p_order_id;

  -- Loyalty notification
  INSERT INTO order_notifications (user_id, order_id, title, body, type, is_read)
  VALUES (
    v_user_id,
    p_order_id,
    'Points Earned!',
    'You earned ' || v_points_to_award || ' points from your order. Balance: ' || v_new_total || ' pts.',
    'order_delivered',
    false
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success',       true,
    'points_awarded', v_points_to_award,
    'new_balance',   v_new_total,
    'tier',          v_new_tier,
    'tier_upgraded', v_new_tier <> v_old_tier
  );
END;
$function$;
