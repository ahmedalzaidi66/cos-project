/*
  # Upgrade safe_redeem_loyalty_points to return transaction_id and accept redeemed_amount

  ## Summary
  Extends the function signature with an optional `p_redeemed_amount` parameter so the
  caller can pass the IQD value of the discount, and returns the inserted
  `loyalty_transaction_id` so checkout can back-reference it on the order row.

  The function remains SECURITY DEFINER and backward-compatible (new params have defaults).
*/

-- Drop old signature so we can add the new parameter
DROP FUNCTION IF EXISTS public.safe_redeem_loyalty_points(uuid, uuid, integer, text);

CREATE FUNCTION public.safe_redeem_loyalty_points(
  p_user_id         uuid,
  p_order_id        uuid,
  p_points          integer,
  p_note            text    DEFAULT NULL,
  p_redeemed_amount numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_loyalty    record;
  v_settings   record;
  v_new_total  integer;
  v_txn_id     uuid;
BEGIN
  -- Validate
  IF p_points <= 0 THEN
    RETURN jsonb_build_object('error', 'points_must_be_positive');
  END IF;

  -- Advisory lock: one redemption per user at a time (prevents race conditions)
  PERFORM pg_advisory_xact_lock(('x' || substring(p_user_id::text, 1, 16))::bit(64)::bigint);

  -- Load settings
  SELECT * INTO v_settings FROM loyalty_settings WHERE id = 1;
  IF NOT v_settings.redeem_enabled THEN
    RETURN jsonb_build_object('error', 'redeeming_disabled');
  END IF;
  IF p_points < v_settings.min_redeem_points THEN
    RETURN jsonb_build_object('error', 'below_minimum', 'minimum', v_settings.min_redeem_points);
  END IF;

  -- Load balance (with lock)
  SELECT * INTO v_loyalty FROM customer_loyalty WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_loyalty_record');
  END IF;

  -- Balance check
  IF v_loyalty.total_points < p_points THEN
    RETURN jsonb_build_object(
      'error',     'insufficient_balance',
      'available', v_loyalty.total_points,
      'requested', p_points
    );
  END IF;

  -- Idempotency guard: if this order already has a confirmed redeem transaction, skip
  SELECT id INTO v_txn_id
  FROM loyalty_transactions
  WHERE order_id = p_order_id AND type = 'redeem' AND status = 'confirmed'
  LIMIT 1;

  IF v_txn_id IS NOT NULL THEN
    -- Already redeemed for this order — return success without double-deducting
    RETURN jsonb_build_object(
      'success',              true,
      'points_redeemed',      p_points,
      'new_balance',          v_loyalty.total_points,
      'loyalty_transaction_id', v_txn_id,
      'already_redeemed',     true
    );
  END IF;

  v_new_total := v_loyalty.total_points - p_points;

  -- Deduct balance
  UPDATE customer_loyalty
  SET total_points = v_new_total, updated_at = now()
  WHERE user_id = p_user_id;

  -- Insert redeem transaction and capture its ID
  INSERT INTO loyalty_transactions
    (user_id, order_id, type, points, balance_after, status, note, description)
  VALUES (
    p_user_id,
    p_order_id,
    'redeem',
    -p_points,
    v_new_total,
    'confirmed',
    COALESCE(p_note, 'Redeemed at checkout'),
    'Points applied as order discount'
  )
  RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success',                true,
    'points_redeemed',        p_points,
    'new_balance',            v_new_total,
    'loyalty_transaction_id', v_txn_id
  );
END;
$$;
