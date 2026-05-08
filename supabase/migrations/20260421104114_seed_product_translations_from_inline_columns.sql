/*
  # Seed product_translations from inline name_ar / name_es / name_de columns

  ## Why
  The admin products screen previously wrote translations into inline columns
  (name_ar, name_es, name_de, description_ar, description_es, description_de)
  on the products table, but the storefront reads from the product_translations
  table via a JOIN. This migration copies all existing inline translations into
  product_translations so both sources are in sync going forward.

  ## What it does
  1. For every product that has name_ar set, upserts an 'ar' row in product_translations.
  2. Same for name_es → 'es' and name_de → 'de'.
  3. Also ensures every product has an English 'en' row (using the product's own name
     and description) so the JOIN always finds a match for English queries.
  4. Uses ON CONFLICT DO NOTHING — existing rows are left untouched.

  ## Tables modified
  - product_translations (INSERT only, no destructive changes)
*/

-- English baseline rows (one per product, skip if already exists)
INSERT INTO product_translations (product_id, language, name, short_description, full_description, meta_title, meta_description)
SELECT
  p.id,
  'en',
  p.name,
  LEFT(p.description, 160),
  p.description,
  p.name,
  LEFT(p.description, 160)
FROM products p
WHERE p.name IS NOT NULL
ON CONFLICT DO NOTHING;

-- Arabic translations
INSERT INTO product_translations (product_id, language, name, short_description, full_description, meta_title, meta_description)
SELECT
  p.id,
  'ar',
  p.name_ar,
  LEFT(COALESCE(p.description_ar, p.description, ''), 160),
  COALESCE(p.description_ar, p.description, ''),
  p.name_ar,
  LEFT(COALESCE(p.description_ar, p.description, ''), 160)
FROM products p
WHERE p.name_ar IS NOT NULL AND p.name_ar <> ''
ON CONFLICT DO NOTHING;

-- Spanish translations
INSERT INTO product_translations (product_id, language, name, short_description, full_description, meta_title, meta_description)
SELECT
  p.id,
  'es',
  p.name_es,
  LEFT(COALESCE(p.description_es, p.description, ''), 160),
  COALESCE(p.description_es, p.description, ''),
  p.name_es,
  LEFT(COALESCE(p.description_es, p.description, ''), 160)
FROM products p
WHERE p.name_es IS NOT NULL AND p.name_es <> ''
ON CONFLICT DO NOTHING;

-- German translations
INSERT INTO product_translations (product_id, language, name, short_description, full_description, meta_title, meta_description)
SELECT
  p.id,
  'de',
  p.name_de,
  LEFT(COALESCE(p.description_de, p.description, ''), 160),
  COALESCE(p.description_de, p.description, ''),
  p.name_de,
  LEFT(COALESCE(p.description_de, p.description, ''), 160)
FROM products p
WHERE p.name_de IS NOT NULL AND p.name_de <> ''
ON CONFLICT DO NOTHING;
