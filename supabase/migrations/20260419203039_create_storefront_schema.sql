/*
  # Storefront Schema — Full Rebuild

  ## Summary
  This migration creates the complete storefront data schema to replace
  all mock/hardcoded data with real database-driven content.

  ## New Tables

  ### 1. categories
  - `id` — uuid primary key
  - `image` — URL to category image
  - `active` — whether the category is shown
  - `created_at`

  ### 2. category_translations
  - `id` — uuid primary key
  - `category_id` — FK to categories
  - `language` — one of en, ar, es, de
  - `name` — localized name
  - `description` — localized description

  ### 3. products (replacement)
  - Replaces old products table. New columns include: slug, category_id (FK),
    compare_price, sku, featured, status, main_image, images (jsonb array),
    specifications (jsonb). Drops old multilingual columns.

  ### 4. product_translations
  - `id` — uuid primary key
  - `product_id` — FK to products
  - `language` — en, ar, es, de
  - `name`, `short_description`, `full_description`, `meta_title`, `meta_description`

  ### 5. cms_content
  - One row per language with all homepage copy fields

  ### 6. theme_settings
  - One row for the active theme (colors, presets)

  ## Security
  - RLS enabled on all tables
  - Public SELECT on all storefront tables (products, categories, translations, cms)
  - theme_settings: public SELECT only
  - Write restricted to authenticated users
*/

-- ─── categories ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image       text DEFAULT '',
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read categories"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY "Authenticated can manage categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (true);

-- ─── category_translations ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS category_translations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  language    text NOT NULL CHECK (language IN ('en','ar','es','de')),
  name        text NOT NULL DEFAULT '',
  description text DEFAULT '',
  UNIQUE (category_id, language)
);

ALTER TABLE category_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read category_translations"
  ON category_translations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated can manage category_translations"
  ON category_translations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update category_translations"
  ON category_translations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can delete category_translations"
  ON category_translations FOR DELETE
  TO authenticated
  USING (true);

-- ─── products (new schema, safe migration) ────────────────────────────────────

-- Add new columns to existing products table rather than dropping it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'slug'
  ) THEN
    ALTER TABLE products ADD COLUMN slug text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE products ADD COLUMN category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'compare_price'
  ) THEN
    ALTER TABLE products ADD COLUMN compare_price numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'sku'
  ) THEN
    ALTER TABLE products ADD COLUMN sku text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'featured'
  ) THEN
    ALTER TABLE products ADD COLUMN featured boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'status'
  ) THEN
    ALTER TABLE products ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active','draft','archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'main_image'
  ) THEN
    ALTER TABLE products ADD COLUMN main_image text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'images'
  ) THEN
    ALTER TABLE products ADD COLUMN images jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'specifications'
  ) THEN
    ALTER TABLE products ADD COLUMN specifications jsonb DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE products ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- ─── product_translations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_translations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  language          text NOT NULL CHECK (language IN ('en','ar','es','de')),
  name              text NOT NULL DEFAULT '',
  short_description text DEFAULT '',
  full_description  text DEFAULT '',
  meta_title        text DEFAULT '',
  meta_description  text DEFAULT '',
  UNIQUE (product_id, language)
);

ALTER TABLE product_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read product_translations"
  ON product_translations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated can manage product_translations"
  ON product_translations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update product_translations"
  ON product_translations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can delete product_translations"
  ON product_translations FOR DELETE
  TO authenticated
  USING (true);

-- ─── cms_content ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cms_content (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language           text NOT NULL CHECK (language IN ('en','ar','es','de')) DEFAULT 'en',
  logo               text DEFAULT '',
  hero_title         text DEFAULT '',
  hero_subtitle      text DEFAULT '',
  hero_button_text   text DEFAULT 'Shop Now',
  hero_image         text DEFAULT '',
  featured_title     text DEFAULT '',
  canopy_title       text DEFAULT '',
  canopy_description text DEFAULT '',
  testimonial_title  text DEFAULT '',
  footer_text        text DEFAULT '',
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (language)
);

ALTER TABLE cms_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read cms_content"
  ON cms_content FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated can manage cms_content"
  ON cms_content FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update cms_content"
  ON cms_content FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── theme_settings ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS theme_settings (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_color        text DEFAULT '#00BFFF',
  secondary_color      text DEFAULT '#0D1E35',
  accent_color         text DEFAULT '#FFD700',
  button_color         text DEFAULT '#00BFFF',
  button_text_color    text DEFAULT '#050A14',
  background_color     text DEFAULT '#050A14',
  card_background_color text DEFAULT '#0D1E35',
  border_color         text DEFAULT 'rgba(0,191,255,0.15)',
  glow_color           text DEFAULT 'rgba(0,191,255,0.08)',
  text_primary_color   text DEFAULT '#E8F4FD',
  text_secondary_color text DEFAULT '#7EB5D6',
  warning_color        text DEFAULT '#FFB300',
  success_color        text DEFAULT '#00E676',
  active_preset        text DEFAULT 'midnight-blue',
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE theme_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read theme_settings"
  ON theme_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated can manage theme_settings"
  ON theme_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update theme_settings"
  ON theme_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
