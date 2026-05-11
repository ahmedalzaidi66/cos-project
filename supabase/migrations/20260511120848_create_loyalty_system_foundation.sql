/*
  # Loyalty & Bonus Points System — Foundation

  ## Overview
  Creates the full loyalty points economy for Lazurde Beauty.
  Customers earn bonus points from completed purchases and can spend them as
  discount money on future orders.

  ## New Columns on `products`
  - `bonus_enabled` (boolean, default false): admin toggle to enable bonus on this product
  - `bonus_points` (integer, default 0): fixed bonus points earned per purchase
  - `bonus_percentage` (numeric 5,2, nullable): optional percentage cashback mode
    (if set and bonus_enabled, points = floor(price * bonus_percentage / 100))

  ## New Tables

  ### `customer_loyalty`
  One row per customer. Holds the live point balance and tier.
  - `id` — uuid primary key
  - `user_id` — FK to auth.users (unique)
  - `total_points` — current spendable balance
  - `lifetime_points` — all-time points earned (for tier calculation)
  - `tier` — 'bronze' | 'silver' | 'gold' | 'platinum'
  - `created_at`, `updated_at`

  ### `loyalty_transactions`
  Immutable audit log of every point movement.
  - `id` — uuid primary key
  - `user_id` — FK to auth.users
  - `order_id` — FK to orders (nullable, for earn/redeem events)
  - `type` — 'earn' | 'redeem' | 'adjust' | 'expire'
  - `points` — positive for earn/adjust-up, negative for redeem/expire
  - `balance_after` — snapshot of total_points after this transaction
  - `note` — free-text description
  - `created_at`

  ## Security
  - RLS enabled on both new tables
  - Customers can SELECT their own rows
  - Admins (service_role) can do full CRUD
  - Customers cannot directly insert/update loyalty balances (only via trusted backend)
  - Public can SELECT bonus columns on products (already covered by existing product policies)

  ## Notes
  - Redemption logic is NOT implemented in this migration (Part 2)
  - Tier thresholds: Bronze 0+, Silver 2000+, Gold 5000+, Platinum 15000+ lifetime pts
*/

-- ─── Add bonus columns to products ──────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'bonus_enabled'
  ) THEN
    ALTER TABLE products ADD COLUMN bonus_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'bonus_points'
  ) THEN
    ALTER TABLE products ADD COLUMN bonus_points integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'bonus_percentage'
  ) THEN
    ALTER TABLE products ADD COLUMN bonus_percentage numeric(5,2);
  END IF;
END $$;

-- ─── customer_loyalty ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_loyalty (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points    integer     NOT NULL DEFAULT 0,
  lifetime_points integer     NOT NULL DEFAULT 0,
  tier            text        NOT NULL DEFAULT 'bronze'
                              CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customer_loyalty ENABLE ROW LEVEL SECURITY;

-- Customers can read their own balance
CREATE POLICY "Users can view own loyalty"
  ON customer_loyalty FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service_role can insert/update balances (triggered by backend/edge functions in Part 2)
CREATE POLICY "Service role can manage loyalty"
  ON customer_loyalty FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update loyalty"
  ON customer_loyalty FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete loyalty"
  ON customer_loyalty FOR DELETE
  TO service_role
  USING (true);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_customer_loyalty_user_id ON customer_loyalty(user_id);

-- ─── loyalty_transactions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id      uuid        REFERENCES orders(id) ON DELETE SET NULL,
  type          text        NOT NULL DEFAULT 'earn'
                            CHECK (type IN ('earn', 'redeem', 'adjust', 'expire')),
  points        integer     NOT NULL,
  balance_after integer     NOT NULL DEFAULT 0,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Customers can read their own transaction history
CREATE POLICY "Users can view own transactions"
  ON loyalty_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service_role can insert transactions
CREATE POLICY "Service role can insert transactions"
  ON loyalty_transactions FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Transactions are immutable — no update/delete for customers
CREATE POLICY "Service role can delete transactions"
  ON loyalty_transactions FOR DELETE
  TO service_role
  USING (true);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_user_id   ON loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_order_id  ON loyalty_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_created   ON loyalty_transactions(created_at DESC);
