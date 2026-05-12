/*
  # Add tier override support and admin_add/admin_subtract transaction types

  ## Summary
  Extends the loyalty system to support:
  1. Manual tier override by admins (override_tier, tier_override_enabled, tier_override_reason, tier_override_updated_by, tier_override_updated_at)
  2. New loyalty_transactions types: admin_add, admin_subtract (more descriptive than the generic 'adjust')
  3. Backward-compatible: existing 'adjust' type still allowed

  ## New columns on customer_loyalty
  - `tier_override_enabled` (boolean, default false) — whether admin has manually set the tier
  - `override_tier` (text, nullable) — the manually set tier if override is enabled
  - `tier_override_reason` (text, nullable) — reason the admin provided
  - `tier_override_updated_by` (uuid, nullable) — admin user_id who set the override
  - `tier_override_updated_at` (timestamptz, nullable) — when the override was last changed

  ## loyalty_transactions type CHECK update
  Add 'admin_add' and 'admin_subtract' to allowed types

  ## Security
  No RLS changes — existing "Service role can update loyalty" policy already covers admin writes
  New admin_adjust_loyalty_points function is SECURITY DEFINER so it bypasses RLS safely
*/

-- ── 1. Add tier override columns to customer_loyalty ──────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_loyalty' AND column_name = 'tier_override_enabled'
  ) THEN
    ALTER TABLE customer_loyalty ADD COLUMN tier_override_enabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_loyalty' AND column_name = 'override_tier'
  ) THEN
    ALTER TABLE customer_loyalty ADD COLUMN override_tier TEXT DEFAULT NULL
      CHECK (override_tier IS NULL OR override_tier = ANY (ARRAY['bronze','silver','gold','platinum']));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_loyalty' AND column_name = 'tier_override_reason'
  ) THEN
    ALTER TABLE customer_loyalty ADD COLUMN tier_override_reason TEXT DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_loyalty' AND column_name = 'tier_override_updated_by'
  ) THEN
    ALTER TABLE customer_loyalty ADD COLUMN tier_override_updated_by UUID DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_loyalty' AND column_name = 'tier_override_updated_at'
  ) THEN
    ALTER TABLE customer_loyalty ADD COLUMN tier_override_updated_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- ── 2. Expand loyalty_transactions.type CHECK to include admin_add / admin_subtract ──

-- Drop old check, re-add with expanded values
ALTER TABLE loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_type_check;

ALTER TABLE loyalty_transactions
  ADD CONSTRAINT loyalty_transactions_type_check
  CHECK (type = ANY (ARRAY[
    'earn', 'redeem', 'adjust', 'expire', 'referral', 'birthday', 'campaign',
    'admin_add', 'admin_subtract'
  ]));
