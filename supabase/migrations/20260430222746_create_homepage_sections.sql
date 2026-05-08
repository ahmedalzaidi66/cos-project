/*
  # Create homepage sections system

  ## Overview
  Allows admins to create dynamic product rows on the homepage with bilingual titles,
  ordering, and per-section product selection.

  ## New Tables

  ### `homepage_sections`
  - `id` (uuid, PK)
  - `title_ar` (text) — Arabic section title e.g. "الأكثر مبيعاً"
  - `title_en` (text) — English section title e.g. "Best Sellers"
  - `is_active` (boolean) — whether this section appears on the homepage
  - `sort_order` (integer) — display order, lower = higher on page
  - `created_at` (timestamptz)

  ### `homepage_section_products`
  - `id` (uuid, PK)
  - `section_id` (uuid, FK → homepage_sections.id, cascade delete)
  - `product_id` (uuid, FK → products.id, cascade delete)
  - `sort_order` (integer) — display order within the section
  - unique constraint on (section_id, product_id)

  ## Security
  - RLS enabled on both tables
  - Public (anon) can SELECT active sections and their products
  - Admin (service role via is_admin_request) can do full CRUD

  ## Seed data
  - 4 default sections inserted: Best Sellers, New Arrivals, Special Offers, Our Picks
*/

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS homepage_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar    text NOT NULL DEFAULT '',
  title_en    text NOT NULL DEFAULT '',
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS homepage_section_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES homepage_sections(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0,
  UNIQUE (section_id, product_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_homepage_sections_sort
  ON homepage_sections (sort_order);

CREATE INDEX IF NOT EXISTS idx_homepage_section_products_section
  ON homepage_section_products (section_id, sort_order);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE homepage_sections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_section_products  ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can read sections (filtered to active on app side)
CREATE POLICY "Public can read homepage sections"
  ON homepage_sections FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read homepage section products"
  ON homepage_section_products FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin write: full CRUD for admins only
CREATE POLICY "Admins can insert homepage sections"
  ON homepage_sections FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update homepage sections"
  ON homepage_sections FOR UPDATE
  TO authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete homepage sections"
  ON homepage_sections FOR DELETE
  TO authenticated
  USING (is_admin_request());

CREATE POLICY "Admins can insert homepage section products"
  ON homepage_section_products FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update homepage section products"
  ON homepage_section_products FOR UPDATE
  TO authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete homepage section products"
  ON homepage_section_products FOR DELETE
  TO authenticated
  USING (is_admin_request());

-- ── Seed default sections ─────────────────────────────────────────────────────

INSERT INTO homepage_sections (title_ar, title_en, is_active, sort_order) VALUES
  ('الأكثر مبيعاً',  'Best Sellers',   true, 1),
  ('منتجات جديدة',   'New Arrivals',   true, 2),
  ('عروض خاصة',      'Special Offers', true, 3),
  ('اختياراتنا',     'Our Picks',      true, 4)
ON CONFLICT DO NOTHING;
