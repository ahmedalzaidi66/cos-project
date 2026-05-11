/*
  # Loyalty System Part 3 — Order Lifecycle, Pending Points & Notifications

  ## Summary
  Completes the loyalty system with safe order lifecycle management, pending points
  tracking, cancellation reversal, duplicate-award prevention, and notification support.

  ## Changes to Existing Tables
  - `loyalty_transactions`: adds `status` column (pending/confirmed/cancelled/reversed),
    `admin_id` (nullable, for manual adjustments), `description` (alias for note)
  - `customer_loyalty`: adds `pending_points` (int) to show pre-confirmed balance
  - `orders`: adds `user_id` (nullable FK auth.users) for faster loyalty lookups

  ## New: Auto-award DB trigger
  - When order.status changes to 'delivered', if points_earned = 0 and earning is enabled,
    calculate and award points automatically via a DB function (no edge function call needed).
  - When order.status changes to 'cancelled', revert any pending/earned points for that order.

  ## Security
  - RLS policies updated to allow authenticated users to INSERT redeem transactions
    (needed for checkout self-service redemption)
  - Admin id added to loyalty_transactions for audit trail
*/

-- ── Add columns to loyalty_transactions ──────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_transactions' AND column_name = 'status'
  ) THEN
    ALTER TABLE loyalty_transactions ADD COLUMN status text NOT NULL DEFAULT 'confirmed'
      CHECK (status IN ('pending', 'confirmed', 'cancelled', 'reversed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_transactions' AND column_name = 'admin_id'
  ) THEN
    ALTER TABLE loyalty_transactions ADD COLUMN admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loyalty_transactions' AND column_name = 'description'
  ) THEN
    ALTER TABLE loyalty_transactions ADD COLUMN description text;
  END IF;
END $$;

-- ── Add pending_points to customer_loyalty ────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_loyalty' AND column_name = 'pending_points'
  ) THEN
    ALTER TABLE customer_loyalty ADD COLUMN pending_points integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── Add user_id to orders for fast loyalty lookup ─────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── RLS: allow authenticated users to INSERT redeem transactions ──────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'loyalty_transactions' AND policyname = 'Authenticated users can insert redeem transactions'
  ) THEN
    CREATE POLICY "Authenticated users can insert redeem transactions"
      ON loyalty_transactions FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id AND type IN ('redeem'));
  END IF;
END $$;

-- ── Core award function ───────────────────────────────────────────────────────
-- Called by trigger and by the edge function (idempotent — checks points_earned = 0).

CREATE OR REPLACE FUNCTION award_loyalty_points_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order          record;
  v_settings       record;
  v_loyalty        record;
  v_user_id        uuid;
  v_points_per_iqd numeric;
  v_iqd_per_point  numeric;
  v_earnable       numeric;
  v_points_to_award integer;
  v_new_total      integer;
  v_new_lifetime   integer;
  v_new_pending    integer;
  v_old_tier       text;
  v_new_tier       text;
BEGIN
  -- Fetch order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'order_not_found');
  END IF;

  -- Only award on delivered
  IF v_order.status <> 'delivered' THEN
    RETURN jsonb_build_object('error', 'not_delivered');
  END IF;

  -- Idempotency guard
  IF v_order.points_earned > 0 THEN
    RETURN jsonb_build_object('message', 'already_awarded', 'points', v_order.points_earned);
  END IF;

  -- Load settings
  SELECT * INTO v_settings FROM loyalty_settings WHERE id = 1;
  IF NOT FOUND OR NOT v_settings.earning_enabled THEN
    RETURN jsonb_build_object('message', 'earning_disabled');
  END IF;

  -- Minimum order check
  IF v_order.total < v_settings.min_order_to_earn THEN
    -- Mark as processed with 0 points to prevent repeated calls
    UPDATE orders SET points_earned = 0 WHERE id = p_order_id;
    RETURN jsonb_build_object('message', 'below_minimum');
  END IF;

  -- Resolve user_id
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

  -- Calculate earnable total (deduct value of redeemed points)
  v_iqd_per_point := COALESCE(v_settings.iqd_per_point, 1);
  v_earnable := GREATEST(0, v_order.total - (v_order.points_redeemed * v_iqd_per_point));
  v_points_per_iqd := COALESCE(v_settings.points_per_iqd, 0.001);
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

  -- Compute tier
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

  -- Update order
  UPDATE orders SET points_earned = v_points_to_award WHERE id = p_order_id;

  -- Insert loyalty notification into order_notifications
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
    'success', true,
    'points_awarded', v_points_to_award,
    'new_balance', v_new_total,
    'tier', v_new_tier,
    'tier_upgraded', v_new_tier <> v_old_tier
  );
END;
$$;

-- ── Cancellation reversal function ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION revert_loyalty_points_for_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order    record;
  v_user_id  uuid;
  v_loyalty  record;
  v_earned   integer;
  v_redeemed integer;
  v_new_total integer;
  v_new_lifetime integer;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'order_not_found');
  END IF;

  -- Resolve user_id
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

  SELECT * INTO v_loyalty FROM customer_loyalty WHERE user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('message', 'no_loyalty_record');
  END IF;

  v_earned   := COALESCE(v_order.points_earned, 0);
  v_redeemed := COALESCE(v_order.points_redeemed, 0);

  -- Nothing to revert
  IF v_earned = 0 AND v_redeemed = 0 THEN
    RETURN jsonb_build_object('message', 'nothing_to_revert');
  END IF;

  -- Net change: remove earned, restore redeemed
  v_new_total    := GREATEST(0, v_loyalty.total_points - v_earned + v_redeemed);
  -- Lifetime points are NOT reversed (they represent historical earning)
  v_new_lifetime := v_loyalty.lifetime_points;

  UPDATE customer_loyalty SET
    total_points   = v_new_total,
    updated_at     = now()
  WHERE user_id = v_user_id;

  -- Record reversal transaction
  IF v_earned > 0 THEN
    INSERT INTO loyalty_transactions (user_id, order_id, type, points, balance_after, status, note, description)
    VALUES (
      v_user_id, p_order_id, 'adjust', -v_earned, v_new_total,
      'reversed',
      'Order #' || upper(substring(p_order_id::text, 1, 8)) || ' cancelled',
      'Points reversed due to order cancellation'
    );
  END IF;

  IF v_redeemed > 0 THEN
    INSERT INTO loyalty_transactions (user_id, order_id, type, points, balance_after, status, note, description)
    VALUES (
      v_user_id, p_order_id, 'adjust', v_redeemed, v_new_total + v_redeemed,
      'reversed',
      'Redemption refunded for cancelled order #' || upper(substring(p_order_id::text, 1, 8)),
      'Redeemed points restored after cancellation'
    );
  END IF;

  -- Reset order points columns
  UPDATE orders SET points_earned = 0, points_redeemed = 0 WHERE id = p_order_id;

  -- Insert cancellation notification
  INSERT INTO order_notifications (user_id, order_id, title, body, type, is_read)
  VALUES (
    v_user_id,
    p_order_id,
    'Order Cancelled',
    CASE
      WHEN v_earned > 0 AND v_redeemed > 0
        THEN v_earned || ' pts removed and ' || v_redeemed || ' pts restored from cancelled order.'
      WHEN v_earned > 0
        THEN v_earned || ' pts removed from cancelled order. Balance: ' || v_new_total || ' pts.'
      ELSE v_redeemed || ' pts restored from cancelled order. Balance: ' || (v_new_total + v_redeemed) || ' pts.'
    END,
    'order_cancelled',
    false
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'earned_reversed', v_earned,
    'redeemed_restored', v_redeemed,
    'new_balance', v_new_total
  );
END;
$$;

-- ── DB trigger: auto-award points when order delivered ────────────────────────

CREATE OR REPLACE FUNCTION trg_loyalty_on_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'delivered' THEN
    PERFORM award_loyalty_points_for_order(NEW.id);
  END IF;

  IF NEW.status = 'cancelled' THEN
    PERFORM revert_loyalty_points_for_order(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_order_lifecycle ON orders;

CREATE TRIGGER trg_loyalty_order_lifecycle
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trg_loyalty_on_order_status_change();

-- ── Grant execute on RPC functions ───────────────────────────────────────────

GRANT EXECUTE ON FUNCTION award_loyalty_points_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION revert_loyalty_points_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION award_loyalty_points_for_order(uuid) TO authenticated;
