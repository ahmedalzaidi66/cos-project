/*
  # FCM Push Integration for Order Status Triggers

  ## Summary
  Extends the existing order notification trigger functions to fire push
  notifications (Expo + FCM) asynchronously via pg_net HTTP calls to the
  send-push-notification Edge Function, immediately after inserting the
  in-app order_notification record.

  ## Changes

  ### Extensions
  - Enables pg_net (async HTTP from PostgreSQL) if not already enabled

  ### Modified Functions
  - `notify_customer_on_order_status_change()` — now also calls send-push-notification
  - `notify_customer_on_order_placed()` — now also calls send-push-notification

  ## Security
  - pg_net calls use SUPABASE_SERVICE_ROLE_KEY via app.settings (set separately)
  - The HTTP call is fire-and-forget (async) — trigger does not wait for response
  - If the Edge Function is unavailable, the in-app notification still succeeds

  ## Notes
  1. Requires app.settings.service_role_key and app.settings.supabase_url to be
     set via ALTER DATABASE ... SET app.settings.xxx = '...';
     These are set automatically by Supabase in the hosted environment.
  2. If pg_net is unavailable, the trigger falls back gracefully (no push, no error).
  3. Existing in-app notification logic is NOT changed — only push is additive.
*/

-- Enable pg_net for async HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- ── Helper: fire push notification asynchronously via pg_net ──────────────────

CREATE OR REPLACE FUNCTION fire_order_push_notification(
  p_user_id  uuid,
  p_title    text,
  p_body     text,
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url         text;
  v_service_key text;
  v_payload     jsonb;
BEGIN
  -- Read Supabase URL and service role key from database settings
  -- These are automatically available in the Supabase hosted environment
  BEGIN
    v_url         := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    -- Settings not available — skip push silently
    RETURN;
  END;

  IF v_url IS NULL OR v_url = '' OR v_service_key IS NULL OR v_service_key = '' THEN
    RETURN;
  END IF;

  v_payload := jsonb_build_object(
    'user_id', p_user_id::text,
    'title',   p_title,
    'body',    p_body,
    'data',    jsonb_build_object(
      'order_id', p_order_id::text,
      'type',     'order_notification'
    )
  );

  -- Fire async HTTP POST via pg_net (non-blocking)
  PERFORM extensions.http_post(
    url     := v_url || '/functions/v1/send-push-notification',
    body    := v_payload::text,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    )
  );

EXCEPTION WHEN OTHERS THEN
  -- Never fail the trigger due to push errors
  RAISE WARNING '[fire_order_push_notification] push dispatch error: %', SQLERRM;
END;
$$;

-- ── Rebuild status-change trigger function with push dispatch ─────────────────

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
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT auth_user_id INTO v_user_id
  FROM customers
  WHERE email = NEW.customer_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

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
      RETURN NEW;
  END CASE;

  -- Insert in-app notification (existing behavior preserved)
  INSERT INTO order_notifications (user_id, order_id, title, body, type, is_read)
  VALUES (v_user_id, NEW.id, v_title, v_body, v_type, false);

  -- Fire push notification asynchronously (new FCM/Expo behavior)
  PERFORM fire_order_push_notification(v_user_id, v_title, v_body, NEW.id);

  RETURN NEW;
END;
$$;

-- ── Rebuild order-placed trigger function with push dispatch ──────────────────

CREATE OR REPLACE FUNCTION notify_customer_on_order_placed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_title   text;
  v_body    text;
BEGIN
  SELECT auth_user_id INTO v_user_id
  FROM customers
  WHERE email = NEW.customer_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_title := 'Order Placed';
  v_body  := 'Thank you! Your order #' || upper(substring(NEW.id::text, 1, 8)) || ' has been placed.';

  -- Insert in-app notification (existing behavior preserved)
  INSERT INTO order_notifications (user_id, order_id, title, body, type, is_read)
  VALUES (v_user_id, NEW.id, v_title, v_body, 'order_placed', false);

  -- Fire push notification asynchronously (new FCM/Expo behavior)
  PERFORM fire_order_push_notification(v_user_id, v_title, v_body, NEW.id);

  RETURN NEW;
END;
$$;

-- Triggers are already defined in previous migration — functions are replaced in-place
-- so no need to recreate the triggers themselves.
