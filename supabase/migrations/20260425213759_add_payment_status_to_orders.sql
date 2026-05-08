/*
  # Add payment_status column to orders

  1. Changes
    - `orders` table: add `payment_status` (text, default 'pending') if not already present

  2. Notes
    - Safe: uses IF NOT EXISTS check
    - COD orders will land with payment_status = 'pending' until fulfilled
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status text NOT NULL DEFAULT 'pending';
  END IF;
END $$;
