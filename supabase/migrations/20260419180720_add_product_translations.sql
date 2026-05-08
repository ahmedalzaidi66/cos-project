/*
  # Add multilingual translation columns to products

  ## Summary
  Adds per-language name and description columns to the products table so each product
  can carry translations for Arabic, Spanish, and German alongside the default English.

  ## Changes
  ### Modified Tables
  - `products`
    - `name_ar` (text, nullable) — Arabic product name
    - `name_es` (text, nullable) — Spanish product name
    - `name_de` (text, nullable) — German product name
    - `description_ar` (text, nullable) — Arabic product description
    - `description_es` (text, nullable) — Spanish product description
    - `description_de` (text, nullable) — German product description

  ## Notes
  - All new columns are nullable; existing rows default to NULL (frontend falls back to English)
  - No existing data is modified
  - RLS policies on products are unchanged
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'name_ar') THEN
    ALTER TABLE products ADD COLUMN name_ar text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'name_es') THEN
    ALTER TABLE products ADD COLUMN name_es text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'name_de') THEN
    ALTER TABLE products ADD COLUMN name_de text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'description_ar') THEN
    ALTER TABLE products ADD COLUMN description_ar text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'description_es') THEN
    ALTER TABLE products ADD COLUMN description_es text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'description_de') THEN
    ALTER TABLE products ADD COLUMN description_de text DEFAULT NULL;
  END IF;
END $$;
