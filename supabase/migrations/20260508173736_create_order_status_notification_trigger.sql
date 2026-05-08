/*
  # Order Status Notification Trigger

  ## What this does
  Installs a PostgreSQL trigger on the `orders` table that fires AFTER each UPDATE.
  When the `status` column changes, it:
  1. Looks up the customer's `auth_user_id` from the `customers` table using `customer_email`.
  2. Inserts a row into `order_notifications` so the customer sees it in their notification center.

  ## Notification types and messages
  Each status maps to a bilingual title/body:
  - confirmed   → Order Confirmed / Your order is confirmed
  - preparing   → Order Being Prepared / We're preparing your order
  - shipped     → Order Shipped / Your order is on its way
  - delivered   → Order Delivered / Your order was delivered
  - cancelled   → Order Cancelled / Your order has been cancelled

  ## Notes
  - Only fires when status actually changes (OLD.status != NEW.status)
  - Only writes if the customer has a matching auth_user_id in the customers table
  - Uses SECURITY DEFINER so the trigger can bypass RLS to insert on behalf of the user
  - The trigger is idempotent (safe to re-create)
*/

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

  -- Resolve customer auth_user_id via email match
  SELECT auth_user_id INTO v_user_id
  FROM customers
  WHERE email = NEW.customer_email
  LIMIT 1;

  -- No registered user — skip (guest checkout)
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build notification content based on new status
  CASE NEW.status
    WHEN 'confirmed' THEN
      v_title := 'Order Confirmed';
      v_body  := 'Your order #' || upper(substring(NEW.id::text, 1, 8)) || ' has been confirmed.';
      v_type  := 'order_confirmed';
    WHEN 'preparing' THEN
      v_title := 'Order Being Prepared';
      v_body  := 'We are preparing your order #' || upper(substring(NEW.id::text, 1, 8)) || '.';
      v_type  := 'order_preparing';
    WHEN 'shipped' THEN
      v_title := 'Order Shipped';
      v_body  := 'Your order #' || upper(substring(NEW.id::text, 1, 8)) || ' is on its way!';
      v_type  := 'order_shipped';
    WHEN 'delivered' THEN
      v_title := 'Order Delivered';
      v_body  := 'Your order #' || upper(substring(NEW.id::text, 1, 8)) || ' has been delivered.';
      v_type  := 'order_delivered';
    WHEN 'cancelled' THEN
      v_title := 'Order Cancelled';
      v_body  := 'Your order #' || upper(substring(NEW.id::text, 1, 8)) || ' has been cancelled.';
      v_type  := 'order_cancelled';
    ELSE
      -- new / other statuses don't produce a notification
      RETURN NEW;
  END CASE;

  -- Insert the notification record
  INSERT INTO order_notifications (user_id, order_id, title, body, type, is_read)
  VALUES (v_user_id, NEW.id, v_title, v_body, v_type, false);

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger to keep it idempotent
DROP TRIGGER IF EXISTS trg_order_status_notification ON orders;

CREATE TRIGGER trg_order_status_notification
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_customer_on_order_status_change();


-- ─── Also create a trigger for new orders (order_placed notification) ──────

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
    'Order Placed',
    'Thank you! Your order #' || upper(substring(NEW.id::text, 1, 8)) || ' has been placed.',
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
