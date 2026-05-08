/*
  # Enhance categories table for homepage display

  ## Changes
  1. categories table
     - Add `icon_url` (text) — URL for the round category icon shown on homepage
     - Add `sort_order` (integer) — controls display order, defaults to 0

  2. category_translations language constraint
     - Extend to include 'ru' so Russian translations can be stored

  ## Notes
  - Both additions are safe (no existing data affected, nullable/defaulted)
  - The language constraint is altered safely using DROP CONSTRAINT + ADD CONSTRAINT
*/

-- Add icon_url column to categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'icon_url'
  ) THEN
    ALTER TABLE categories ADD COLUMN icon_url text DEFAULT '' NOT NULL;
  END IF;
END $$;

-- Add sort_order column to categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE categories ADD COLUMN sort_order integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Extend language constraint on category_translations to include 'ru'
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'category_translations'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%language%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE category_translations DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

ALTER TABLE category_translations
  ADD CONSTRAINT category_translations_language_check
  CHECK (language = ANY (ARRAY['en','ar','es','de','ru']));

-- Ensure fetchCategories orders by sort_order (no SQL needed — app query handles it)
-- Update existing categories to have sequential sort_order values
UPDATE categories SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY slug) - 1 AS rn
  FROM categories
) sub
WHERE categories.id = sub.id AND categories.sort_order = 0;
