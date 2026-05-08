/*
  # Backfill Missing Translations for All Languages

  1. Purpose
    - Ensure every active product has a translation row for all 5 languages
    - Ensure every active category has a translation row for all 5 languages
    - Ensure homepage_content (hero section) exists for all 5 languages
    - Ensure cms_content exists for all 5 languages
    - Missing rows are seeded from English as fallback

  2. Strategy
    - Use INSERT ... ON CONFLICT DO NOTHING to avoid overwriting existing translations
    - All 5 languages: en, ar, es, de, ru
*/

-- 1. Backfill product_translations for all active products in all languages
-- For each active product, insert translations for any missing languages using English product data
INSERT INTO product_translations (product_id, language, name, short_description, full_description, meta_title, meta_description)
SELECT
  p.id,
  lang.code,
  COALESCE(existing.name, p.name, ''),
  COALESCE(existing.short_description, p.description, ''),
  COALESCE(existing.full_description, p.description, ''),
  COALESCE(existing.meta_title, p.name, ''),
  COALESCE(existing.meta_description, LEFT(p.description, 160), '')
FROM products p
CROSS JOIN (VALUES ('en'), ('ar'), ('es'), ('de'), ('ru')) AS lang(code)
LEFT JOIN product_translations existing
  ON existing.product_id = p.id AND existing.language = lang.code
LEFT JOIN product_translations en_trans
  ON en_trans.product_id = p.id AND en_trans.language = 'en'
WHERE p.status = 'active'
  AND existing.product_id IS NULL
ON CONFLICT (product_id, language) DO NOTHING;

-- 2. Backfill category_translations for all active categories in all languages
INSERT INTO category_translations (category_id, language, name, description)
SELECT
  c.id,
  lang.code,
  COALESCE(existing.name, en_trans.name, REPLACE(INITCAP(c.slug), '-', ' '), c.slug),
  COALESCE(existing.description, en_trans.description, '')
FROM categories c
CROSS JOIN (VALUES ('en'), ('ar'), ('es'), ('de'), ('ru')) AS lang(code)
LEFT JOIN category_translations existing
  ON existing.category_id = c.id AND existing.language = lang.code
LEFT JOIN category_translations en_trans
  ON en_trans.category_id = c.id AND en_trans.language = 'en'
WHERE c.active = true
  AND existing.category_id IS NULL
ON CONFLICT (category_id, language) DO NOTHING;

-- 3. Backfill homepage_content hero section for all languages from English
INSERT INTO homepage_content (section, key, value, language, updated_at)
SELECT
  en_row.section,
  en_row.key,
  en_row.value,
  lang.code,
  now()
FROM homepage_content en_row
CROSS JOIN (VALUES ('ar'), ('es'), ('de'), ('ru')) AS lang(code)
LEFT JOIN homepage_content existing
  ON existing.section = en_row.section
  AND existing.key = en_row.key
  AND existing.language = lang.code
WHERE en_row.language = 'en'
  AND en_row.section = 'hero'
  AND existing.id IS NULL
ON CONFLICT (section, key, language) DO NOTHING;

-- 4. Backfill cms_content for all languages from English
INSERT INTO cms_content (
  language, logo, hero_title, hero_subtitle, hero_button_text,
  hero_image, featured_title, canopy_title, canopy_description,
  testimonial_title, footer_text
)
SELECT
  lang.code,
  en_row.logo,
  en_row.hero_title,
  en_row.hero_subtitle,
  en_row.hero_button_text,
  en_row.hero_image,
  en_row.featured_title,
  en_row.canopy_title,
  en_row.canopy_description,
  en_row.testimonial_title,
  en_row.footer_text
FROM cms_content en_row
CROSS JOIN (VALUES ('ar'), ('es'), ('de'), ('ru')) AS lang(code)
LEFT JOIN cms_content existing ON existing.language = lang.code
WHERE en_row.language = 'en'
  AND existing.id IS NULL
ON CONFLICT DO NOTHING;
