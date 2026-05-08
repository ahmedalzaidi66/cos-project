/*
  # Fix Language CHECK Constraints and Seed Russian Content

  1. Changes
    - Drop and recreate language CHECK constraints on cms_content and product_translations to include 'ru'
    - Insert Russian row into cms_content
    - Seed Russian hero content into homepage_content
    - Seed Russian category translations into category_translations
    - Seed Russian product translations into product_translations
*/

-- 1. Fix CHECK constraints to include 'ru'
ALTER TABLE cms_content DROP CONSTRAINT IF EXISTS cms_content_language_check;
ALTER TABLE cms_content ADD CONSTRAINT cms_content_language_check
  CHECK (language = ANY (ARRAY['en'::text, 'ar'::text, 'es'::text, 'de'::text, 'ru'::text]));

ALTER TABLE product_translations DROP CONSTRAINT IF EXISTS product_translations_language_check;
ALTER TABLE product_translations ADD CONSTRAINT product_translations_language_check
  CHECK (language = ANY (ARRAY['en'::text, 'ar'::text, 'es'::text, 'de'::text, 'ru'::text]));

-- 2. Insert Russian row into cms_content
INSERT INTO cms_content (
  language, logo, hero_title, hero_subtitle, hero_button_text,
  hero_image, featured_title, canopy_title, canopy_description,
  testimonial_title, footer_text
)
SELECT
  'ru',
  logo,
  'Снаряжение профессионального уровня',
  'Проверено в реальных прыжках',
  'Купить сейчас',
  hero_image,
  featured_title,
  canopy_title,
  canopy_description,
  testimonial_title,
  footer_text
FROM cms_content
WHERE language = 'en'
ON CONFLICT DO NOTHING;

-- 3. Seed Russian hero content into homepage_content
INSERT INTO homepage_content (section, key, value, language, updated_at) VALUES
  ('hero', 'title',         'Проверено в реальных прыжках',        'ru', now()),
  ('hero', 'subtitle',      'Снаряжение профессионального уровня', 'ru', now()),
  ('hero', 'badge_text',    'ПРОФЕССИОНАЛЬНЫЙ УРОВЕНЬ',             'ru', now()),
  ('hero', 'cta_primary',   'Купить сейчас',                        'ru', now()),
  ('hero', 'cta_secondary', 'Узнать больше',                        'ru', now()),
  ('hero', 'media_type',    'image',                                'ru', now()),
  ('hero', 'image_url',     '',                                     'ru', now()),
  ('hero', 'video_url',     '',                                     'ru', now()),
  ('hero', 'overlay_color', 'rgba(5,10,20,0.55)',                   'ru', now())
ON CONFLICT (section, key, language) DO NOTHING;

-- 4. Seed Russian category translations (copy from English)
INSERT INTO category_translations (category_id, language, name, description)
SELECT category_id, 'ru', name, description
FROM category_translations
WHERE language = 'en'
ON CONFLICT (category_id, language) DO NOTHING;

-- 5. Seed Russian product translations (copy from English for all active products)
INSERT INTO product_translations (product_id, language, name, short_description, full_description, meta_title, meta_description)
SELECT p.id, 'ru', p.name, p.description, p.description, p.name, p.description
FROM products p
WHERE p.status = 'active'
ON CONFLICT (product_id, language) DO NOTHING;
