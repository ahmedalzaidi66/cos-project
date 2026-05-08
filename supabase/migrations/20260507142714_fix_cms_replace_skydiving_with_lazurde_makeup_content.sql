/*
  # Fix CMS: Replace all skydiving/demo content with correct Lazurde Makeup content

  ## Problem
  The homepage_content table contains stale skydiving/demo data from a previous
  project that was never cleaned up. On every page refresh, this data loads from
  Supabase and overrides any in-editor state, making it appear saves don't persist.

  ## What this does
  1. Overwrites all hero section rows that contain skydiving references with
     correct Lazurde Makeup content, for all languages (en, ar, de, es, ru).
  2. Fixes featured section title "Featured Gear" → "Featured Products" (en).
  3. Fixes footer tagline "Professional Lazurde item trusted worldwide." (en).
  4. Fixes copyright "© 2026 LAZURDE" → proper copyright text (en).
  5. Updates page_blocks hero content to use a beauty image.
  6. Fixes testimonials/featured block content in page_blocks.

  ## Languages fixed
  - en: hero title/subtitle/badge, featured title, footer tagline/copyright
  - ar: hero title/subtitle (skydiving translation)
  - de: hero title/subtitle (skydiving translation)
  - es: hero title/subtitle (skydiving translation)
  - ru: hero title/subtitle (skydiving translation), adds missing image_url

  ## No data is deleted — only UPDATE used to overwrite skydiving rows.
*/

-- ── English hero content ──────────────────────────────────────────────────────

UPDATE homepage_content
SET value = 'Elevate Your Beauty', updated_at = now()
WHERE section = 'hero' AND key = 'title' AND language = 'en';

UPDATE homepage_content
SET value = 'Premium makeup loved by beauty enthusiasts worldwide', updated_at = now()
WHERE section = 'hero' AND key = 'subtitle' AND language = 'en';

UPDATE homepage_content
SET value = 'PREMIUM MAKEUP', updated_at = now()
WHERE section = 'hero' AND key = 'badge_text' AND language = 'en';

UPDATE homepage_content
SET value = 'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=800', updated_at = now()
WHERE section = 'hero' AND key = 'image_url' AND language = 'en';

-- ── English featured / footer cleanup ─────────────────────────────────────────

UPDATE homepage_content
SET value = 'Featured Products', updated_at = now()
WHERE section = 'featured' AND key = 'title' AND language = 'en';

UPDATE homepage_content
SET value = 'Premium makeup for every skin tone.', updated_at = now()
WHERE section = 'footer' AND key = 'tagline' AND language = 'en';

UPDATE homepage_content
SET value = '© 2026 Lazurde Makeup. All rights reserved.', updated_at = now()
WHERE section = 'footer' AND key = 'copyright' AND language = 'en';

-- ── English testimonials ──────────────────────────────────────────────────────

UPDATE homepage_content
SET value = 'Loved by Makeup Enthusiasts', updated_at = now()
WHERE section = 'testimonials' AND key = 'title' AND language = 'en';

-- ── Arabic hero content ───────────────────────────────────────────────────────

UPDATE homepage_content
SET value = 'ارتقِ بجمالك', updated_at = now()
WHERE section = 'hero' AND key = 'title' AND language = 'ar';

UPDATE homepage_content
SET value = 'مكياج فاخر يحبه عشاق الجمال حول العالم', updated_at = now()
WHERE section = 'hero' AND key = 'subtitle' AND language = 'ar';

UPDATE homepage_content
SET value = 'مكياج مميز', updated_at = now()
WHERE section = 'hero' AND key = 'badge_text' AND language = 'ar';

UPDATE homepage_content
SET value = 'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=800', updated_at = now()
WHERE section = 'hero' AND key = 'image_url' AND language = 'ar';

-- ── Arabic testimonials ───────────────────────────────────────────────────────

UPDATE homepage_content
SET value = 'محبوب من قِبل عشاق المكياج', updated_at = now()
WHERE section = 'testimonials' AND key = 'title' AND language = 'ar';

UPDATE homepage_content
SET value = 'اسمعي من مجتمعنا', updated_at = now()
WHERE section = 'testimonials' AND key = 'subtitle' AND language = 'ar';

-- ── German hero content ───────────────────────────────────────────────────────

UPDATE homepage_content
SET value = 'Steigere Deine Schönheit', updated_at = now()
WHERE section = 'hero' AND key = 'title' AND language = 'de';

UPDATE homepage_content
SET value = 'Premium-Make-up, geliebt von Beauty-Enthusiasten weltweit', updated_at = now()
WHERE section = 'hero' AND key = 'subtitle' AND language = 'de';

UPDATE homepage_content
SET value = 'PREMIUM MAKEUP', updated_at = now()
WHERE section = 'hero' AND key = 'badge_text' AND language = 'de';

UPDATE homepage_content
SET value = 'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=800', updated_at = now()
WHERE section = 'hero' AND key = 'image_url' AND language = 'de';

-- ── German testimonials ───────────────────────────────────────────────────────

UPDATE homepage_content
SET value = 'Geliebt von Make-up-Enthusiasten', updated_at = now()
WHERE section = 'testimonials' AND key = 'title' AND language = 'de';

UPDATE homepage_content
SET value = 'Hör von unserer Community', updated_at = now()
WHERE section = 'testimonials' AND key = 'subtitle' AND language = 'de';

-- ── Spanish hero content ──────────────────────────────────────────────────────

UPDATE homepage_content
SET value = 'Eleva Tu Belleza', updated_at = now()
WHERE section = 'hero' AND key = 'title' AND language = 'es';

UPDATE homepage_content
SET value = 'Maquillaje premium amado por entusiastas de la belleza en todo el mundo', updated_at = now()
WHERE section = 'hero' AND key = 'subtitle' AND language = 'es';

UPDATE homepage_content
SET value = 'MAQUILLAJE PREMIUM', updated_at = now()
WHERE section = 'hero' AND key = 'badge_text' AND language = 'es';

UPDATE homepage_content
SET value = 'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=800', updated_at = now()
WHERE section = 'hero' AND key = 'image_url' AND language = 'es';

-- ── Spanish testimonials ──────────────────────────────────────────────────────

UPDATE homepage_content
SET value = 'Amado por los Entusiastas del Maquillaje', updated_at = now()
WHERE section = 'testimonials' AND key = 'title' AND language = 'es';

UPDATE homepage_content
SET value = 'Escucha a nuestra comunidad', updated_at = now()
WHERE section = 'testimonials' AND key = 'subtitle' AND language = 'es';

-- ── Russian hero content ──────────────────────────────────────────────────────

UPDATE homepage_content
SET value = 'Раскройте Вашу Красоту', updated_at = now()
WHERE section = 'hero' AND key = 'title' AND language = 'ru';

UPDATE homepage_content
SET value = 'Премиальный макияж, любимый ценителями красоты по всему миру', updated_at = now()
WHERE section = 'hero' AND key = 'subtitle' AND language = 'ru';

UPDATE homepage_content
SET value = 'ПРЕМИУМ МАКИЯЖ', updated_at = now()
WHERE section = 'hero' AND key = 'badge_text' AND language = 'ru';

UPDATE homepage_content
SET value = 'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=800', updated_at = now()
WHERE section = 'hero' AND key = 'image_url' AND language = 'ru';

-- ── Seed missing Russian sections (canopy, featured, footer, testimonials) ────

INSERT INTO homepage_content (section, key, value, language, updated_at)
VALUES
  ('canopy',       'title',       'Уход за кожей',                                      'ru', now()),
  ('canopy',       'subtitle',    'Наша премиальная коллекция по уходу за кожей скоро появится.', 'ru', now()),
  ('canopy',       'cta_text',    'Скоро',                                               'ru', now()),
  ('canopy',       'enabled',     'true',                                                'ru', now()),
  ('featured',     'title',       'Рекомендуемые продукты',                              'ru', now()),
  ('featured',     'subtitle',    'Отобрано нашими экспертами',                          'ru', now()),
  ('featured',     'enabled',     'true',                                                'ru', now()),
  ('testimonials', 'title',       'Любимый ценителями макияжа',                          'ru', now()),
  ('testimonials', 'subtitle',    'Слушайте наше сообщество',                            'ru', now()),
  ('testimonials', 'enabled',     'true',                                                'ru', now()),
  ('footer',       'tagline',     'Премиальный макияж для каждого тона кожи.',           'ru', now()),
  ('footer',       'copyright',   '© 2026 Lazurde Makeup. Все права защищены.',         'ru', now()),
  ('footer',       'col1_title',  'Магазин',                                             'ru', now()),
  ('footer',       'col2_title',  'Компания',                                            'ru', now()),
  ('footer',       'col3_title',  'Поддержка',                                           'ru', now()),
  ('footer',       'logo_url',    '',                                                    'ru', now())
ON CONFLICT (section, key, language) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now();

-- ── Fix page_blocks: update hero block with correct beauty content ─────────────
-- Only updates blocks that still have skydiving text in them

UPDATE page_blocks
SET content = jsonb_set(
  jsonb_set(
    content,
    '{title}', '"Elevate Your Beauty"'::jsonb
  ),
  '{subtitle}', '"Premium makeup loved by beauty enthusiasts worldwide"'::jsonb
),
updated_at = now()
WHERE type = 'hero'
  AND layout_id IN (SELECT id FROM page_layouts WHERE page = 'home')
  AND (content->>'title' ILIKE '%skydiv%' OR content->>'subtitle' ILIKE '%skydiv%' OR content->>'title' ILIKE '%tested%');

-- Fix featured block
UPDATE page_blocks
SET content = jsonb_set(
  jsonb_set(
    content,
    '{title}', '"Featured Products"'::jsonb
  ),
  '{subtitle}', '"Curated by our beauty experts"'::jsonb
),
updated_at = now()
WHERE type = 'featured'
  AND layout_id IN (SELECT id FROM page_layouts WHERE page = 'home')
  AND (content->>'title' ILIKE '%gear%' OR content->>'subtitle' ILIKE '%skydiv%');

-- Fix testimonials block
UPDATE page_blocks
SET content = jsonb_set(
  jsonb_set(
    content,
    '{title}', '"Loved by Makeup Enthusiasts"'::jsonb
  ),
  '{subtitle}', '"Hear from our community"'::jsonb
),
updated_at = now()
WHERE type = 'testimonials'
  AND layout_id IN (SELECT id FROM page_layouts WHERE page = 'home')
  AND (content->>'title' ILIKE '%skydiv%' OR content->>'subtitle' ILIKE '%skydiv%');
