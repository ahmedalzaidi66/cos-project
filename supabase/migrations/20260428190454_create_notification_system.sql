/*
  # Notification System — Full Schema

  ## Summary
  Creates a complete multi-channel notification system with:
  - `customers` table for storing subscriber opt-in preferences
  - `notifications` table for admin-created notification campaigns
  - `notification_recipients` table for per-customer delivery tracking
  - `notification_reads` table for in-app read state per user

  ## New Tables

  ### customers
  Stores contact info and notification opt-in preferences for storefront users.
  - id, auth_user_id (links to Supabase auth), name, phone, email
  - whatsapp_opt_in, email_opt_in, app_opt_in booleans
  - created_at, updated_at

  ### notifications
  Admin-created notification campaigns.
  - id, title, message, type (offer | new_product | custom)
  - channel (app | push | whatsapp | email | multiple)
  - target (all | selected)
  - status (draft | sent | failed)
  - created_at, sent_at

  ### notification_recipients
  Per-customer delivery record for each notification.
  - id, notification_id, customer_id (nullable), auth_user_id (nullable)
  - phone, email, channel, status (pending | sent | failed), sent_at

  ### notification_reads
  Tracks which authenticated users have read which in-app notifications.
  - id, notification_id, auth_user_id, read_at

  ## Security
  - RLS enabled on all tables
  - Customers: users can read/upsert their own row; admins can read all
  - Notifications: public can read sent app notifications; admins manage all
  - Notification recipients: admins full access; users read their own
  - Notification reads: users manage their own read state
*/

-- ─── customers ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name           text NOT NULL DEFAULT '',
  phone          text NOT NULL DEFAULT '',
  email          text NOT NULL DEFAULT '',
  whatsapp_opt_in boolean NOT NULL DEFAULT false,
  email_opt_in    boolean NOT NULL DEFAULT false,
  app_opt_in      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_email_check CHECK (email = '' OR email ~* '^[^@]+@[^@]+\.[^@]+$')
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_auth_user_id_idx ON customers (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers (email) WHERE email <> '';
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers (phone) WHERE phone <> '';

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own customer row"
  ON customers FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert own customer row"
  ON customers FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update own customer row"
  ON customers FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Admins: allow SELECT via is_admin_request() (reuse existing pattern)
CREATE POLICY "Admins can read all customers"
  ON customers FOR SELECT
  USING (is_admin_request());

CREATE POLICY "Admins can update all customers"
  ON customers FOR UPDATE
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- ─── notifications ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL DEFAULT '',
  message    text NOT NULL DEFAULT '',
  type       text NOT NULL DEFAULT 'custom'
               CONSTRAINT notifications_type_check CHECK (type IN ('offer','new_product','custom')),
  channel    text NOT NULL DEFAULT 'app'
               CONSTRAINT notifications_channel_check CHECK (channel IN ('app','push','whatsapp','email','multiple')),
  target     text NOT NULL DEFAULT 'all'
               CONSTRAINT notifications_target_check CHECK (target IN ('all','selected')),
  status     text NOT NULL DEFAULT 'draft'
               CONSTRAINT notifications_status_check CHECK (status IN ('draft','sent','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at    timestamptz
);

CREATE INDEX IF NOT EXISTS notifications_status_idx ON notifications (status);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read sent app notifications
CREATE POLICY "Users can read sent app notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (status = 'sent' AND channel IN ('app','multiple'));

-- Anonymous users can also read sent app notifications (for public inbox)
CREATE POLICY "Public can read sent app notifications"
  ON notifications FOR SELECT
  TO anon
  USING (status = 'sent' AND channel IN ('app','multiple'));

CREATE POLICY "Admins can read all notifications"
  ON notifications FOR SELECT
  USING (is_admin_request());

CREATE POLICY "Admins can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update notifications"
  ON notifications FOR UPDATE
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete notifications"
  ON notifications FOR DELETE
  USING (is_admin_request());

-- ─── notification_recipients ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_recipients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  customer_id     uuid REFERENCES customers(id) ON DELETE SET NULL,
  auth_user_id    uuid,
  phone           text NOT NULL DEFAULT '',
  email           text NOT NULL DEFAULT '',
  channel         text NOT NULL DEFAULT 'app'
                    CONSTRAINT notif_recip_channel_check CHECK (channel IN ('app','push','whatsapp','email')),
  status          text NOT NULL DEFAULT 'pending'
                    CONSTRAINT notif_recip_status_check CHECK (status IN ('pending','sent','failed')),
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notif_recip_notification_id_idx ON notification_recipients (notification_id);
CREATE INDEX IF NOT EXISTS notif_recip_auth_user_id_idx    ON notification_recipients (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notif_recip_status_idx          ON notification_recipients (status);

ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own recipient rows"
  ON notification_recipients FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Admins can read all recipients"
  ON notification_recipients FOR SELECT
  USING (is_admin_request());

CREATE POLICY "Admins can insert recipients"
  ON notification_recipients FOR INSERT
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update recipients"
  ON notification_recipients FOR UPDATE
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete recipients"
  ON notification_recipients FOR DELETE
  USING (is_admin_request());

-- ─── notification_reads ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_reads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  auth_user_id    uuid NOT NULL,
  read_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, auth_user_id)
);

CREATE INDEX IF NOT EXISTS notif_reads_user_idx ON notification_reads (auth_user_id);

ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own read receipts"
  ON notification_reads FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert own read receipts"
  ON notification_reads FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can delete own read receipts"
  ON notification_reads FOR DELETE
  TO authenticated
  USING (auth_user_id = auth.uid());
