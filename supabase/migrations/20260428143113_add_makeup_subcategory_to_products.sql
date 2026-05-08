/*
  # Add makeup_subcategory to products

  ## Summary
  Adds an optional `makeup_subcategory` column to the `products` table to allow
  makeup products to be classified into: lips, face, eye, nail.

  ## Changes
  - `products.makeup_subcategory` (text, nullable) — constrained to: lips | face | eye | nail
  - A partial index is added for efficient filtering by subcategory within makeup products.
  - Existing products are unaffected; NULL means "show under Makeup > All".

  ## Security
  - No new tables, no RLS changes needed — the existing products policies apply.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'makeup_subcategory'
  ) THEN
    ALTER TABLE products ADD COLUMN makeup_subcategory text
      CONSTRAINT products_makeup_subcategory_check
      CHECK (makeup_subcategory IN ('lips', 'face', 'eye', 'nail'));
  END IF;
END $$;

-- Partial index for fast subcategory filtering
CREATE INDEX IF NOT EXISTS idx_products_makeup_subcategory
  ON products (makeup_subcategory)
  WHERE makeup_subcategory IS NOT NULL;
