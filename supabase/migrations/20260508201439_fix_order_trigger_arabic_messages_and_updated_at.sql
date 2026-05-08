/*
  # Fix order notification trigger: Arabic messages + updated_at stamping

  ## Changes

  ### 1. Auto-stamp updated_at on every order UPDATE
  A lightweight trigger that sets updated_at = now() on every row change,
  so the customer's realtime subscription sees the change timestamp.

  ### 2. Rebuild notify_customer_on_order_status_change with Arabic messages
  Bilingual title/body so customers see Arabic text in their notification center.
  Adds 'new' and 'pending' status support (previously skipped as ELSE → RETURN NEW).

  ### 3. notify_customer_on_order_placed — also bilingual
*/

-- ── 1. Auto-stamp updated_at ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_orders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_updated_at ON orders;
CREATE TRIGGER trg_orders_set_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_orders_updated_at();

-- ── 2. Rebuild status change notification trigger ───────────────────────────

CREATE OR REPLACE FUNCTION notify_customer_on_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_title   text;
  v_body    text;
  v_type    text;
BEGIN
  -- Only act when status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Resolve customer auth_user_id via email match in customers table
  SELECT auth_user_id INTO v_user_id
  FROM customers
  WHERE email = NEW.customer_email
  LIMIT 1;

  -- No registered user (guest checkout) — skip silently
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map status → bilingual title / body / type
  CASE NEW.status
    WHEN 'confirmed' THEN
      v_title := 'تم تأكيد طلبك · Order Confirmed';
      v_body  := 'تم تأكيد طلبك #' || upper(substring(NEW.id::text, 1, 8)) || ' بنجاح. Your order has been confirmed.';
      v_type  := 'order_confirmed';
    WHEN 'preparing' THEN
      v_title := 'طلبك قيد التحضير · Order Being Prepared';
      v_body  := 'طلبك #' || upper(substring(NEW.id::text, 1, 8)) || ' قيد التحضير الآن. We are preparing your order.';
      v_type  := 'order_preparing';
    WHEN 'shipped' THEN
      v_title := 'تم شحن طلبك · Order Shipped';
      v_body  := 'طلبك #' || upper(substring(NEW.id::text, 1, 8)) || ' في الطريق إليك! Your order is on its way!';
      v_type  := 'order_shipped';
    WHEN 'delivered' THEN
      v_title := 'تم توصيل طلبك · Order Delivered';
      v_body  := 'تم توصيل طلبك #' || upper(substring(NEW.id::text, 1, 8)) || ' بنجاح. Your order has been delivered.';
      v_type  := 'order_delivered';
    WHEN 'cancelled' THEN
      v_title := 'تم إلغاء طلبك · Order Cancelled';
      v_body  := 'تم إلغاء طلبك #' || upper(substring(NEW.id::text, 1, 8)) || '. Your order has been cancelled.';
      v_type  := 'order_cancelled';
    WHEN 'new' THEN
      v_title := 'طلب جديد · New Order';
      v_body  := 'تم استلام طلبك #' || upper(substring(NEW.id::text, 1, 8)) || '. Your order has been received.';
      v_type  := 'order_placed';
    ELSE
      -- Unknown status — skip
      RETURN NEW;
  END CASE;

  -- Insert notification (SECURITY DEFINER bypasses RLS)
  INSERT INTO order_notifications (user_id, order_id, title, body, type, is_read)
  VALUES (v_user_id, NEW.id, v_title, v_body, v_type, false);

  RETURN NEW;
END;
$$;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_order_status_notification ON orders;
CREATE TRIGGER trg_order_status_notification
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_customer_on_order_status_change();

-- ── 3. Rebuild order placed notification trigger ────────────────────────────

CREATE OR REPLACE FUNCTION notify_customer_on_order_placed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT auth_user_id INTO v_user_id
  FROM customers
  WHERE email = NEW.customer_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO order_notifications (user_id, order_id, title, body, type, is_read)
  VALUES (
    v_user_id,
    NEW.id,
    'تم استلام طلبك · Order Placed',
    'شكراً! تم استلام طلبك #' || upper(substring(NEW.id::text, 1, 8)) || '. Thank you! Your order has been placed.',
    'order_placed',
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_placed_notification ON orders;
CREATE TRIGGER trg_order_placed_notification
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_customer_on_order_placed();
