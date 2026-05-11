/*
  # Loyalty System Part 2 — Settings Table & Order Point Columns

  ## Summary
  Extends the loyalty system with global configuration and per-order point tracking.

  ## New Tables
  - `loyalty_settings` — global loyalty rules (singleton row, id=1)

  ## Modified Tables
  - `orders`: adds `points_earned` and `points_redeemed` columns
*/

-- loyalty_settings (singleton configuration table)
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  earning_enabled boolean NOT NULL DEFAULT true,
  redeeming_enabled boolean NOT NULL DEFAULT true,
  points_per_iqd numeric(10,4) NOT NULL DEFAULT 0.001,
  iqd_per_point numeric(10,4) NOT NULL DEFAULT 1.0,
  min_order_to_earn integer NOT NULL DEFAULT 0,
  min_points_to_redeem integer NOT NULL DEFAULT 100,
  max_redeem_percent integer NOT NULL DEFAULT 50 CHECK (max_redeem_percent BETWEEN 0 AND 100),
  updated_at timestamptz DEFAULT now()
);

-- Seed default row
INSERT INTO loyalty_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'loyalty_settings' AND policyname = 'Anyone can read loyalty settings'
  ) THEN
    CREATE POLICY "Anyone can read loyalty settings"
      ON loyalty_settings FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'loyalty_settings' AND policyname = 'Service role can update loyalty settings'
  ) THEN
    CREATE POLICY "Service role can update loyalty settings"
      ON loyalty_settings FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'loyalty_settings' AND policyname = 'Service role can insert loyalty settings'
  ) THEN
    CREATE POLICY "Service role can insert loyalty settings"
      ON loyalty_settings FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- Add point columns to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'points_earned'
  ) THEN
    ALTER TABLE orders ADD COLUMN points_earned integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'points_redeemed'
  ) THEN
    ALTER TABLE orders ADD COLUMN points_redeemed integer NOT NULL DEFAULT 0;
  END IF;
END $$;
