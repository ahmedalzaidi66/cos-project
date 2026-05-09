/*
  # Create hero_slides table

  ## Summary
  Replaces the single hero banner with a multi-slide carousel system.

  ## New Tables
  - `hero_slides`
    - `id` (uuid, pk)
    - `sort_order` (int) — controls display order; lowest first
    - `is_active` (bool) — only active slides appear on storefront
    - `media_type` ('image' | 'video')
    - `image_url` (text)
    - `video_url` (text)
    - `badge_text` (text)
    - `title` (text)
    - `subtitle` (text)
    - `cta_text` (text) — button label
    - `cta_url` (text) — button destination path
    - `overlay_opacity` (numeric 0–1)
    - `language` (text, default 'en') — reserved for per-language slides
    - `created_at`, `updated_at`

  ## Security
  - RLS enabled
  - Anonymous/authenticated users can SELECT active slides
  - Only admin token holders (service role via adminSupabase) can INSERT/UPDATE/DELETE

  ## Notes
  - Seeds 3 default slides so the carousel is immediately populated
  - overlay_opacity stored as numeric (0.0–1.0), not as rgba string, for simpler admin UI
*/

CREATE TABLE IF NOT EXISTS hero_slides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order    int  NOT NULL DEFAULT 0,
  is_active     bool NOT NULL DEFAULT true,
  media_type    text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  image_url     text NOT NULL DEFAULT '',
  video_url     text NOT NULL DEFAULT '',
  badge_text    text NOT NULL DEFAULT '',
  title         text NOT NULL DEFAULT '',
  subtitle      text NOT NULL DEFAULT '',
  cta_text      text NOT NULL DEFAULT '',
  cta_url       text NOT NULL DEFAULT '',
  overlay_opacity numeric(4,3) NOT NULL DEFAULT 0.550 CHECK (overlay_opacity >= 0 AND overlay_opacity <= 1),
  language      text NOT NULL DEFAULT 'en',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hero_slides ENABLE ROW LEVEL SECURITY;

-- Public read: only active slides
CREATE POLICY "Public can read active hero slides"
  ON hero_slides FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Service role (adminSupabase) can do everything
CREATE POLICY "Service role full access to hero slides"
  ON hero_slides FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update hero slides"
  ON hero_slides FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete hero slides"
  ON hero_slides FOR DELETE
  TO service_role
  USING (true);

-- Index for fast ordered fetch
CREATE INDEX IF NOT EXISTS idx_hero_slides_sort ON hero_slides (sort_order ASC, created_at ASC);

-- Seed 3 default slides
INSERT INTO hero_slides (sort_order, is_active, media_type, image_url, badge_text, title, subtitle, cta_text, cta_url, overlay_opacity)
VALUES
  (0, true,  'image', 'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=1200',
   'NEW COLLECTION', 'Beauty That Makes You Shine', 'Premium cosmetics loved by beauty enthusiasts worldwide', 'Shop Now', '/(tabs)/products', 0.550),
  (1, true,  'image', 'https://images.pexels.com/photos/1961795/pexels-photo-1961795.jpeg?auto=compress&cs=tinysrgb&w=1200',
   'BESTSELLERS', 'Discover Your Perfect Shade', 'Find the color that was made for you', 'Explore Shades', '/(tabs)/canopy', 0.500),
  (2, true,  'image', 'https://images.pexels.com/photos/3373738/pexels-photo-3373738.jpeg?auto=compress&cs=tinysrgb&w=1200',
   'LUXURY SKINCARE', 'Radiance in Every Drop', 'Elevate your daily ritual with our premium formulas', 'View Skincare', '/(tabs)/products', 0.520)
ON CONFLICT DO NOTHING;
