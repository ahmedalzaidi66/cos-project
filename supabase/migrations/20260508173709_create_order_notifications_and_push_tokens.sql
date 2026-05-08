/*
  # Order Notifications & Push Tokens

  ## New Tables

  ### user_push_tokens
  Stores Expo push notification tokens per user device.
  - `id` — primary key
  - `user_id` — auth.uid() of the registered user
  - `token` — Expo push token string
  - `platform` — 'ios' | 'android' | 'web'
  - `created_at` — when the token was registered
  - `updated_at` — last seen / refreshed

  ### order_notifications
  Persistent in-app notification records scoped to a specific order and user.
  Unlike the broadcast `notifications` table, these are 1:1 (one user, one order event).
  - `id` — primary key
  - `user_id` — auth.uid() of the customer
  - `order_id` — the related order UUID
  - `title` — short notification title (bilingual-ready)
  - `body` — longer message body
  - `type` — 'order_placed' | 'order_confirmed' | 'order_preparing' | 'order_shipped' | 'order_delivered' | 'order_cancelled'
  - `is_read` — whether the user has read it
  - `created_at` — timestamp

  ## Security
  - RLS enabled on both tables
  - Only the owning user can select/update their own rows
  - Inserts to order_notifications allowed for authenticated users (own rows only)
  - user_push_tokens: owner can insert/update/delete their own tokens

  ## Indexes
  - order_notifications(user_id, is_read) for fast unread count
  - order_notifications(order_id) for per-order history
  - user_push_tokens(user_id) for fast token lookup
*/

-- ─── user_push_tokens ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL,
  platform    text NOT NULL DEFAULT 'web',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON user_push_tokens(user_id);

CREATE POLICY "Users can view own push tokens"
  ON user_push_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens"
  ON user_push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens"
  ON user_push_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens"
  ON user_push_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── order_notifications ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  type        text NOT NULL DEFAULT 'order_placed',
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_order_notifs_user_id ON order_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_order_notifs_order_id ON order_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_order_notifs_created ON order_notifications(created_at DESC);

CREATE POLICY "Users can view own order notifications"
  ON order_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own order notifications"
  ON order_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role (edge functions / triggers) can insert for any user
CREATE POLICY "Service can insert order notifications"
  ON order_notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ─── Enable Realtime on key tables ─────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE order_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
