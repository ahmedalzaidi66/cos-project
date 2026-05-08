/*
  # Add notes and admin_notes columns to orders

  ## Changes
  - Adds `notes` (text, nullable) — customer-facing order notes entered at checkout
  - Adds `admin_notes` (text, nullable) — internal notes added by admin

  ## Notes
  - Both columns are nullable; existing rows get NULL by default (no data loss)
  - Safe IF NOT EXISTS guards prevent errors on re-run
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'notes'
  ) THEN
    ALTER TABLE orders ADD COLUMN notes text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE orders ADD COLUMN admin_notes text;
  END IF;
END $$;
