/*
  # Create about_content table

  ## Summary
  Stores all About / Contact page content, editable from the admin dashboard.
  Each row is a key-value pair scoped to a section and language, matching the
  homepage_content pattern already used for hero/featured/canopy content.

  ## New Tables
  - `about_content`
    - `id` (uuid, PK)
    - `section` (text) — one of: 'brand', 'social', 'contact', 'shipping', 'return', 'footer'
    - `key` (text) — field name within the section (e.g. 'description', 'whatsapp', 'instagram_url')
    - `value` (text) — the content value
    - `language` (text) — language code: en / ar / es / de / ru
    - `updated_at` (timestamptz)
    - UNIQUE(section, key, language)

  ## Security
  - RLS enabled; anon can SELECT (public page); only authenticated admin requests can INSERT/UPDATE/DELETE
    via is_admin_request() (same pattern as homepage_content).

  ## Seed Data
  Default English content is seeded so the page renders immediately.
*/

CREATE TABLE IF NOT EXISTS about_content (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section     text NOT NULL,
  key         text NOT NULL,
  value       text NOT NULL DEFAULT '',
  language    text NOT NULL DEFAULT 'en',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section, key, language)
);

ALTER TABLE about_content ENABLE ROW LEVEL SECURITY;

-- Anyone can read (public about page)
CREATE POLICY "Public can read about content"
  ON about_content FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only verified admin requests can write
CREATE POLICY "Admins can insert about content"
  ON about_content FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update about content"
  ON about_content FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete about content"
  ON about_content FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- Index for fast language-filtered fetches
CREATE INDEX IF NOT EXISTS idx_about_content_language ON about_content (language);
CREATE INDEX IF NOT EXISTS idx_about_content_section  ON about_content (section, language);

-- ─── Default English seed data ────────────────────────────────────────────────

INSERT INTO about_content (section, key, value, language) VALUES
  -- Brand section
  ('brand', 'name',        'SKYDIVER MAN GEAR',                                                         'en'),
  ('brand', 'tagline',     'Professional gear trusted by skydivers worldwide',                           'en'),
  ('brand', 'description', 'We design and supply premium skydiving equipment trusted by 10,000+ professionals across the globe. Every product is tested in real free-fall conditions before it reaches you.', 'en'),
  ('brand', 'mission',     'To equip every skydiver — from first-jump to world-record — with gear that performs when it matters most.', 'en'),

  -- Social links (language-neutral — same for all languages, stored under en)
  ('social', 'instagram_url', 'https://www.instagram.com', 'en'),
  ('social', 'instagram_handle', '@skydivermanGear', 'en'),
  ('social', 'tiktok_url', 'https://www.tiktok.com', 'en'),
  ('social', 'tiktok_handle', '@skydivermanGear', 'en'),
  ('social', 'facebook_url', 'https://www.facebook.com', 'en'),
  ('social', 'facebook_handle', 'Skydiver Man Gear', 'en'),

  -- Contact
  ('contact', 'whatsapp', '15550001234',      'en'),
  ('contact', 'email',    'support@skydivermagear.com', 'en'),
  ('contact', 'phone',    '+1 (800) 555-0199', 'en'),

  -- Shipping policy
  ('shipping', 'title',    'Shipping Policy',                                    'en'),
  ('shipping', 'delivery', '3–7 business days (domestic). 7–14 days international.', 'en'),
  ('shipping', 'areas',    'We ship worldwide to 80+ countries.',                 'en'),
  ('shipping', 'cost',     'Free shipping on orders over $500. Flat $15 below.', 'en'),

  -- Return policy
  ('return', 'title',      'Return Policy',                                      'en'),
  ('return', 'days',       '30-day returns on unused items in original packaging.', 'en'),
  ('return', 'conditions', 'Item must be unused, unaltered, with original tags.', 'en'),
  ('return', 'refund',     'Full refund to original payment method within 5–10 business days.', 'en'),

  -- Footer
  ('footer', 'copyright', '© 2026 Skydiver Man Gear. All rights reserved.', 'en')
ON CONFLICT (section, key, language) DO NOTHING;
