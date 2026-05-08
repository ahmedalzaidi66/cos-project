/*
  # Add governorate and area columns to orders table

  ## Purpose
  The checkout now collects country, governorate, and area to look up the
  correct shipping rule. These fields need to be stored on the order.

  ## Changes to orders
  - Add `governorate` (text) — province / muhafaza selected at checkout
  - Add `area`        (text) — specific district selected at checkout

  Both are nullable (existing orders have no value). They default to empty
  string for new orders so the column is never truly null going forward.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'governorate'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN governorate text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'area'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN area text NOT NULL DEFAULT '';
  END IF;
END $$;
