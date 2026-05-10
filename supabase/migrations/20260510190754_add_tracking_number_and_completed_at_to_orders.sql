/*
  # Add tracking_number and completed_at to orders

  ## Changes
  - `tracking_number` (text, nullable): stores shipping/courier tracking number
  - `completed_at` (timestamptz, nullable): timestamp when order was delivered/completed

  ## Notes
  - Both columns are optional and nullable
  - No RLS changes needed — existing order policies cover these new columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tracking_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN tracking_number text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN completed_at timestamptz;
  END IF;
END $$;
