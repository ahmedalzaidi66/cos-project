/*
  # Subcategory System

  ## Summary
  Adds a full subcategory system so products can belong to both a main category and a subcategory.

  ## New Tables

  ### subcategories
  - `id` uuid PK
  - `category_id` uuid FK → categories.id (CASCADE delete)
  - `slug` text — URL-safe unique identifier per category
  - `icon_url` text — optional icon image
  - `display_order` int — sort position within parent category
  - `is_active` boolean — controls storefront visibility
  - `is_deleted` boolean — soft delete flag
  - `deleted_at`, `deleted_by` — audit trail
  - `created_at`, `updated_at`

  ### subcategory_translations
  - `id` uuid PK
  - `subcategory_id` uuid FK → subcategories.id (CASCADE delete)
  - `language` text — 'en', 'ar', 'es', 'de', 'ru', 'ku'
  - `name` text
  - `description` text
  - UNIQUE (subcategory_id, language)

  ## Modified Tables

  ### products
  - Added `subcategory_id` uuid nullable FK → subcategories.id (SET NULL on delete)
    Existing products continue working with NULL subcategory.

  ## Security
  - RLS enabled on both new tables
  - Public: SELECT active/non-deleted subcategories + translations
  - Admin (via is_admin_request()): full CRUD

  ## Seed Data
  Default subcategories for common Lazurde categories:
  - makeup: Face, Lips, Eyes, Nails, Brushes
  - skincare: Cleansers, Serums, Moisturizers, Sunscreen, Masks
  - haircare: Shampoo, Conditioner, Treatment, Styling
  - fragrances: Women, Men, Unisex
*/

-- ─── subcategories ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subcategories (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  slug           text NOT NULL,
  icon_url       text NOT NULL DEFAULT '',
  display_order  int  NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  is_deleted     boolean NOT NULL DEFAULT false,
  deleted_at     timestamptz,
  deleted_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON subcategories (category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_is_active   ON subcategories (is_active) WHERE is_deleted = false;

ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active subcategories"
  ON subcategories FOR SELECT
  USING (is_active = true AND is_deleted = false);

CREATE POLICY "Admin can insert subcategories"
  ON subcategories FOR INSERT
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update subcategories"
  ON subcategories FOR UPDATE
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete subcategories"
  ON subcategories FOR DELETE
  USING (is_admin_request());

-- ─── subcategory_translations ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subcategory_translations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id   uuid NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
  language         text NOT NULL CHECK (language IN ('en','ar','es','de','ru','ku')),
  name             text NOT NULL DEFAULT '',
  description      text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subcategory_id, language)
);

CREATE INDEX IF NOT EXISTS idx_subcategory_translations_sub_id ON subcategory_translations (subcategory_id);

ALTER TABLE subcategory_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read subcategory translations"
  ON subcategory_translations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM subcategories s
      WHERE s.id = subcategory_id
        AND s.is_active = true
        AND s.is_deleted = false
    )
  );

CREATE POLICY "Admin can insert subcategory translations"
  ON subcategory_translations FOR INSERT
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update subcategory translations"
  ON subcategory_translations FOR UPDATE
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete subcategory translations"
  ON subcategory_translations FOR DELETE
  USING (is_admin_request());

-- ─── products: add subcategory_id column ─────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'subcategory_id'
  ) THEN
    ALTER TABLE products ADD COLUMN subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON products (subcategory_id) WHERE subcategory_id IS NOT NULL;

-- ─── Seed default subcategories ──────────────────────────────────────────────
-- Only inserts if the parent category slug exists (no-op otherwise)

DO $$
DECLARE
  cat_id uuid;

  -- Makeup subcategories
  sub_face_id  uuid;
  sub_lips_id  uuid;
  sub_eyes_id  uuid;
  sub_nails_id uuid;
  sub_brush_id uuid;

  -- Skincare subcategories
  sub_cleanse_id    uuid;
  sub_serum_id      uuid;
  sub_moisturize_id uuid;
  sub_sunscreen_id  uuid;
  sub_mask_id       uuid;

  -- Haircare subcategories
  sub_shampoo_id    uuid;
  sub_conditioner_id uuid;
  sub_treatment_id  uuid;
  sub_styling_id    uuid;

  -- Fragrances subcategories
  sub_frag_women_id  uuid;
  sub_frag_men_id    uuid;
  sub_frag_unisex_id uuid;

BEGIN

  -- ── Makeup ──────────────────────────────────────────────────────────────────
  SELECT id INTO cat_id FROM categories WHERE slug = 'makeup' AND is_deleted = false LIMIT 1;
  IF cat_id IS NOT NULL THEN
    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'face',    0) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_face_id;
    IF sub_face_id IS NULL THEN SELECT id INTO sub_face_id FROM subcategories WHERE category_id = cat_id AND slug = 'face'; END IF;

    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'lips',    1) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_lips_id;
    IF sub_lips_id IS NULL THEN SELECT id INTO sub_lips_id FROM subcategories WHERE category_id = cat_id AND slug = 'lips'; END IF;

    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'eyes',    2) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_eyes_id;
    IF sub_eyes_id IS NULL THEN SELECT id INTO sub_eyes_id FROM subcategories WHERE category_id = cat_id AND slug = 'eyes'; END IF;

    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'nails',   3) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_nails_id;
    IF sub_nails_id IS NULL THEN SELECT id INTO sub_nails_id FROM subcategories WHERE category_id = cat_id AND slug = 'nails'; END IF;

    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'brushes', 4) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_brush_id;
    IF sub_brush_id IS NULL THEN SELECT id INTO sub_brush_id FROM subcategories WHERE category_id = cat_id AND slug = 'brushes'; END IF;

    -- Translations
    INSERT INTO subcategory_translations (subcategory_id, language, name) VALUES
      (sub_face_id,  'en', 'Face'),    (sub_face_id,  'ar', 'وجه'),
      (sub_lips_id,  'en', 'Lips'),    (sub_lips_id,  'ar', 'شفاه'),
      (sub_eyes_id,  'en', 'Eyes'),    (sub_eyes_id,  'ar', 'عيون'),
      (sub_nails_id, 'en', 'Nails'),   (sub_nails_id, 'ar', 'أظافر'),
      (sub_brush_id, 'en', 'Brushes'), (sub_brush_id, 'ar', 'فرش')
    ON CONFLICT (subcategory_id, language) DO NOTHING;
  END IF;

  -- ── Skincare ─────────────────────────────────────────────────────────────────
  SELECT id INTO cat_id FROM categories WHERE slug = 'skincare' AND is_deleted = false LIMIT 1;
  IF cat_id IS NOT NULL THEN
    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'cleansers',    0) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_cleanse_id;
    IF sub_cleanse_id IS NULL THEN SELECT id INTO sub_cleanse_id FROM subcategories WHERE category_id = cat_id AND slug = 'cleansers'; END IF;

    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'serums',       1) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_serum_id;
    IF sub_serum_id IS NULL THEN SELECT id INTO sub_serum_id FROM subcategories WHERE category_id = cat_id AND slug = 'serums'; END IF;

    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'moisturizers', 2) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_moisturize_id;
    IF sub_moisturize_id IS NULL THEN SELECT id INTO sub_moisturize_id FROM subcategories WHERE category_id = cat_id AND slug = 'moisturizers'; END IF;

    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'sunscreen',    3) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_sunscreen_id;
    IF sub_sunscreen_id IS NULL THEN SELECT id INTO sub_sunscreen_id FROM subcategories WHERE category_id = cat_id AND slug = 'sunscreen'; END IF;

    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'masks',        4) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_mask_id;
    IF sub_mask_id IS NULL THEN SELECT id INTO sub_mask_id FROM subcategories WHERE category_id = cat_id AND slug = 'masks'; END IF;

    INSERT INTO subcategory_translations (subcategory_id, language, name) VALUES
      (sub_cleanse_id,    'en', 'Cleansers'),    (sub_cleanse_id,    'ar', 'منظفات'),
      (sub_serum_id,      'en', 'Serums'),        (sub_serum_id,      'ar', 'سيرم'),
      (sub_moisturize_id, 'en', 'Moisturizers'),  (sub_moisturize_id, 'ar', 'مرطبات'),
      (sub_sunscreen_id,  'en', 'Sunscreen'),      (sub_sunscreen_id,  'ar', 'واقي شمس'),
      (sub_mask_id,       'en', 'Masks'),          (sub_mask_id,       'ar', 'أقنعة')
    ON CONFLICT (subcategory_id, language) DO NOTHING;
  END IF;

  -- ── Haircare ─────────────────────────────────────────────────────────────────
  SELECT id INTO cat_id FROM categories WHERE slug = 'haircare' AND is_deleted = false LIMIT 1;
  IF cat_id IS NOT NULL THEN
    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'shampoo',     0) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_shampoo_id;
    IF sub_shampoo_id IS NULL THEN SELECT id INTO sub_shampoo_id FROM subcategories WHERE category_id = cat_id AND slug = 'shampoo'; END IF;

    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'conditioner', 1) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_conditioner_id;
    IF sub_conditioner_id IS NULL THEN SELECT id INTO sub_conditioner_id FROM subcategories WHERE category_id = cat_id AND slug = 'conditioner'; END IF;

    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'treatment',   2) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_treatment_id;
    IF sub_treatment_id IS NULL THEN SELECT id INTO sub_treatment_id FROM subcategories WHERE category_id = cat_id AND slug = 'treatment'; END IF;

    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'styling',     3) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_styling_id;
    IF sub_styling_id IS NULL THEN SELECT id INTO sub_styling_id FROM subcategories WHERE category_id = cat_id AND slug = 'styling'; END IF;

    INSERT INTO subcategory_translations (subcategory_id, language, name) VALUES
      (sub_shampoo_id,     'en', 'Shampoo'),     (sub_shampoo_id,     'ar', 'شامبو'),
      (sub_conditioner_id, 'en', 'Conditioner'), (sub_conditioner_id, 'ar', 'بلسم'),
      (sub_treatment_id,   'en', 'Treatment'),   (sub_treatment_id,   'ar', 'علاج'),
      (sub_styling_id,     'en', 'Styling'),      (sub_styling_id,     'ar', 'تصفيف')
    ON CONFLICT (subcategory_id, language) DO NOTHING;
  END IF;

  -- ── Fragrances ───────────────────────────────────────────────────────────────
  SELECT id INTO cat_id FROM categories WHERE slug = 'fragrances' AND is_deleted = false LIMIT 1;
  IF cat_id IS NULL THEN
    SELECT id INTO cat_id FROM categories WHERE slug = 'fragrance' AND is_deleted = false LIMIT 1;
  END IF;
  IF cat_id IS NOT NULL THEN
    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'women',  0) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_frag_women_id;
    IF sub_frag_women_id IS NULL THEN SELECT id INTO sub_frag_women_id FROM subcategories WHERE category_id = cat_id AND slug = 'women'; END IF;

    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'men',    1) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_frag_men_id;
    IF sub_frag_men_id IS NULL THEN SELECT id INTO sub_frag_men_id FROM subcategories WHERE category_id = cat_id AND slug = 'men'; END IF;

    INSERT INTO subcategories (category_id, slug, display_order) VALUES (cat_id, 'unisex', 2) ON CONFLICT (category_id, slug) DO NOTHING RETURNING id INTO sub_frag_unisex_id;
    IF sub_frag_unisex_id IS NULL THEN SELECT id INTO sub_frag_unisex_id FROM subcategories WHERE category_id = cat_id AND slug = 'unisex'; END IF;

    INSERT INTO subcategory_translations (subcategory_id, language, name) VALUES
      (sub_frag_women_id,  'en', 'Women'),  (sub_frag_women_id,  'ar', 'نساء'),
      (sub_frag_men_id,    'en', 'Men'),    (sub_frag_men_id,    'ar', 'رجال'),
      (sub_frag_unisex_id, 'en', 'Unisex'), (sub_frag_unisex_id, 'ar', 'للجنسين')
    ON CONFLICT (subcategory_id, language) DO NOTHING;
  END IF;

END $$;
