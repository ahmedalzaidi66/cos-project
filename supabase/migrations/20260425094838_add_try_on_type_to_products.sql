/*
  # Add try_on_type column to products

  ## Summary
  Adds an optional `try_on_type` column to the `products` table so admin users can
  explicitly set which Virtual Try-On category a product belongs to, overriding the
  automatic category inference.

  ## Changes
  - `products.try_on_type` (text, nullable) — one of: lipstick | blush | concealer | foundation
    When set, the Virtual Try-On modal uses this value directly instead of inferring
    the category from the product's `category` field.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'try_on_type'
  ) THEN
    ALTER TABLE products ADD COLUMN try_on_type text DEFAULT NULL;
  END IF;
END $$;
