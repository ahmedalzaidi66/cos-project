/*
  # Fix loyalty award function — full idempotency against duplicate constraint

  ## Problem
  The `award_loyalty_points_for_order` function checks `orders.points_earned > 0`
  as its idempotency guard. However this guard fails when:
    1. A previous call inserted into `loyalty_transactions` successfully but then
       crashed before executing `UPDATE orders SET points_earned = v_points_to_award`,
       leaving points_earned = 0 while an earn transaction already exists.
    2. Status is set to 'delivered' a second time (e.g. cancelled → delivered → cancelled → delivered)
       — the trigger fires again, the points_earned column was reset, but the transaction row exists.

  In both cases the INSERT into loyalty_transactions raises:
    "duplicate key value violates unique constraint loyalty_txn_unique_earn_per_order"
  which bubbles up and causes the entire `orders.update` call to fail, so the order
  status never saves to 'delivered'.

  ## Fix
  Add a second idempotency guard that queries loyalty_transactions directly.
  If a confirmed 'earn' row already exists for this order:
    - Re-sync orders.points_earned from the existing transaction (repairs drift)
    - Return 'already_awarded' immediately — do NOT re-insert

  Also wrap the INSERT in an EXCEPTION handler so that even if the unique constraint
  fires (race condition), the error is swallowed and the order status update succeeds.

  ## No destructive changes
  - Unique constraint stays enabled
  - Existing transaction rows are unchanged
  - customer_loyalty balances are unchanged
  - All other statuses unaffected
*/

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
  v_existing_txn    record;
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

  -- ── Primary idempotency guard: check orders.points_earned ────────────────────
  IF COALESCE(v_order.points_earned, 0) > 0 THEN
    RETURN jsonb_build_object('message', 'already_awarded', 'points', v_order.points_earned);
  END IF;

  -- ── Secondary idempotency guard: check loyalty_transactions directly ─────────
  -- Catches the case where the transaction row exists but points_earned wasn't saved
  SELECT * INTO v_existing_txn
  FROM loyalty_transactions
  WHERE order_id = p_order_id
    AND type = 'earn'
    AND status = 'confirmed'
  LIMIT 1;

  IF FOUND THEN
    -- Repair the drift: sync points_earned back onto the order row
    UPDATE orders SET points_earned = v_existing_txn.points WHERE id = p_order_id;
    RETURN jsonb_build_object(
      'message', 'already_awarded',
      'points',  v_existing_txn.points,
      'note',    'repaired_drift'
    );
  END IF;

  -- Load settings with safe fallback if row missing
  SELECT * INTO v_settings FROM loyalty_settings WHERE id = 1;
  IF NOT FOUND THEN
    v_iqd_per_point  := 1.0;
    v_points_per_iqd := 1.0;
  ELSE
    IF NOT COALESCE(v_settings.earning_enabled, v_settings.is_active, true) THEN
      RETURN jsonb_build_object('message', 'earning_disabled');
    END IF;

    IF v_order.total < COALESCE(v_settings.minimum_order_amount, 0) THEN
      UPDATE orders SET points_earned = 0 WHERE id = p_order_id;
      RETURN jsonb_build_object('message', 'below_minimum');
    END IF;

    v_iqd_per_point := COALESCE(v_settings.points_value, 100);

    v_points_per_iqd := COALESCE(
      v_settings.point_conversion_rate,
      CASE WHEN COALESCE(v_settings.points_per_order_unit, 0) > 0
           THEN v_settings.points_per_order_unit::numeric / 1000.0
           ELSE 1.0
      END
    );
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

  -- Calculate earnable total
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

  -- Insert earn transaction — wrapped in exception handler as final safety net
  BEGIN
    INSERT INTO loyalty_transactions (user_id, order_id, type, points, balance_after, status, note, description)
    VALUES (
      v_user_id, p_order_id, 'earn', v_points_to_award, v_new_total,
      'confirmed',
      'Order #' || upper(substring(p_order_id::text, 1, 8)) || ' delivered',
      'Points earned from completed order'
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Another concurrent call already inserted this transaction; treat as success
      -- Undo the customer_loyalty increment since points were already counted
      UPDATE customer_loyalty
      SET
        total_points    = GREATEST(0, total_points - v_points_to_award),
        lifetime_points = GREATEST(0, lifetime_points - v_points_to_award),
        updated_at      = now()
      WHERE user_id = v_user_id;

      -- Sync points_earned from the existing transaction row
      SELECT points INTO v_points_to_award
      FROM loyalty_transactions
      WHERE order_id = p_order_id AND type = 'earn' AND status = 'confirmed'
      LIMIT 1;

      UPDATE orders SET points_earned = COALESCE(v_points_to_award, 0) WHERE id = p_order_id;

      RETURN jsonb_build_object(
        'message', 'already_awarded',
        'points',  COALESCE(v_points_to_award, 0),
        'note',    'concurrent_duplicate_skipped'
      );
  END;

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
    'success',        true,
    'points_awarded', v_points_to_award,
    'new_balance',    v_new_total,
    'tier',           v_new_tier,
    'tier_upgraded',  v_new_tier <> v_old_tier
  );
END;
$function$;
