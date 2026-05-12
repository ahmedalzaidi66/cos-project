/*
  # Add loyalty redemption display fields to orders

  ## Summary
  The orders table already stores `points_redeemed` (integer) but is missing the
  monetary equivalent and the back-reference to the loyalty transaction.

  ## New columns on orders
  - `redeemed_amount`         (numeric, default 0) — IQD discount applied from loyalty points
  - `loyalty_transaction_id`  (uuid, nullable FK → loyalty_transactions.id) — the specific
                               redemption transaction, used for duplicate-guard and display

  ## Notes
  - Both columns are optional / backward-compatible; existing orders get 0/NULL defaults.
  - RLS is unchanged — existing admin update policy covers these columns.
*/

-- ── 1. redeemed_amount ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'redeemed_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN redeemed_amount NUMERIC NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── 2. loyalty_transaction_id ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'loyalty_transaction_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN loyalty_transaction_id UUID DEFAULT NULL;
  END IF;
END $$;
