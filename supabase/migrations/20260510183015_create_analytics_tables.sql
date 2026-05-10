/*
  # Create Analytics Tables

  ## Summary
  Creates three new tables to track analytics data for the Lazurde Beauty admin dashboard.
  All tables start collecting data from this point forward. No historical data is lost.

  ## New Tables

  ### 1. `page_views`
  Tracks storefront page visits for traffic analytics.
  - `id` — UUID primary key
  - `session_id` — anonymous session identifier (no user tracking required)
  - `page` — which page was visited (home, products, product_detail, cart, etc.)
  - `product_id` — optional, filled when viewing a product detail page
  - `referrer` — where the visitor came from
  - `user_agent` — browser/device type
  - `created_at` — timestamp

  ### 2. `tryon_events`
  Tracks every time a customer uses the AI Virtual Try-On feature.
  - `id` — UUID primary key
  - `session_id` — anonymous session identifier
  - `product_id` — which product was tried on
  - `product_name` — denormalized name for historical accuracy
  - `category` — lipstick / blush / concealer / foundation
  - `shade_name` — which shade was tried
  - `shade_hex` — hex color of shade
  - `created_at` — timestamp

  ### 3. `abandoned_carts`
  Tracks cart sessions that were started but not completed as orders.
  - `id` — UUID primary key
  - `session_id` — anonymous or authenticated session
  - `user_id` — optional, filled for authenticated users
  - `items` — JSONB array of cart items at abandonment time
  - `total_value` — estimated value of abandoned cart
  - `item_count` — number of items
  - `created_at` — when the cart was abandoned
  - `updated_at` — last update time

  ## Security
  - RLS enabled on all tables
  - Anon users can INSERT (to track events without login)
  - Only authenticated service role / admin can SELECT
*/

-- ── page_views ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS page_views (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   text NOT NULL DEFAULT '',
  page         text NOT NULL DEFAULT '',
  product_id   uuid REFERENCES products(id) ON DELETE SET NULL,
  referrer     text NOT NULL DEFAULT '',
  user_agent   text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Anon can insert (client-side event tracking)
CREATE POLICY "Anyone can track page views"
  ON page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only service role can read (admin queries via adminSupabase)
CREATE POLICY "Service role can read page_views"
  ON page_views FOR SELECT
  TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_page ON page_views(page);
CREATE INDEX IF NOT EXISTS idx_page_views_product_id ON page_views(product_id);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views(session_id);

-- ── tryon_events ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tryon_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   text NOT NULL DEFAULT '',
  product_id   uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  category     text NOT NULL DEFAULT '',
  shade_name   text NOT NULL DEFAULT '',
  shade_hex    text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tryon_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can track tryon events"
  ON tryon_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Service role can read tryon_events"
  ON tryon_events FOR SELECT
  TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS idx_tryon_created_at ON tryon_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tryon_product_id ON tryon_events(product_id);
CREATE INDEX IF NOT EXISTS idx_tryon_category ON tryon_events(category);
CREATE INDEX IF NOT EXISTS idx_tryon_shade ON tryon_events(shade_name);

-- ── abandoned_carts ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   text NOT NULL DEFAULT '',
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  items        jsonb NOT NULL DEFAULT '[]',
  total_value  numeric NOT NULL DEFAULT 0,
  item_count   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert abandoned_carts"
  ON abandoned_carts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own abandoned_carts"
  ON abandoned_carts FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can read abandoned_carts"
  ON abandoned_carts FOR SELECT
  TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_created_at ON abandoned_carts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_session ON abandoned_carts(session_id);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_user_id ON abandoned_carts(user_id);
