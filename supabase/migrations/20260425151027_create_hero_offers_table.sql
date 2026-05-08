/*
  # Create hero_offers table

  ## Purpose
  Stores the ordered list of offer/promotion slides that power the homepage hero carousel.
  Admins can add, edit, reorder, and delete slides from the dashboard.

  ## New Table: hero_offers
  - id              (uuid, PK)           — unique slide identifier
  - sort_order      (int, default 0)     — display order, ascending
  - active          (bool, default true) — toggle visibility without deleting
  - media_type      (text)              — 'image' or 'video'
  - image_url       (text)              — background image URL
  - video_url       (text)              — background video URL (web only)
  - badge_text      (text)              — pill badge above title (e.g. "NEW ARRIVAL")
  - title           (text)              — main headline
  - subtitle        (text)              — supporting copy
  - button_text     (text)              — CTA button label
  - link_type       (text)              — 'product' | 'category' | 'page' | 'url'
  - link_value      (text)              — slug / id / path / full URL
  - overlay_color   (text)              — rgba overlay on media
  - created_at      (timestamptz)
  - updated_at      (timestamptz)

  ## Security
  - RLS enabled; anon users can SELECT active slides (storefront reads)
  - Only admin requests (is_admin_request()) can INSERT / UPDATE / DELETE
*/

CREATE TABLE IF NOT EXISTS hero_offers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order    int         NOT NULL DEFAULT 0,
  active        boolean     NOT NULL DEFAULT true,
  media_type    text        NOT NULL DEFAULT 'image',
  image_url     text        NOT NULL DEFAULT '',
  video_url     text        NOT NULL DEFAULT '',
  badge_text    text        NOT NULL DEFAULT '',
  title         text        NOT NULL DEFAULT '',
  subtitle      text        NOT NULL DEFAULT '',
  button_text   text        NOT NULL DEFAULT 'Shop Now',
  link_type     text        NOT NULL DEFAULT 'page',
  link_value    text        NOT NULL DEFAULT '/(tabs)/products',
  overlay_color text        NOT NULL DEFAULT 'rgba(10,5,7,0.55)',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hero_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active hero offers"
  ON hero_offers FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can insert hero offers"
  ON hero_offers FOR INSERT
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update hero offers"
  ON hero_offers FOR UPDATE
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete hero offers"
  ON hero_offers FOR DELETE
  USING (is_admin_request());

CREATE INDEX IF NOT EXISTS hero_offers_sort_order_idx ON hero_offers (sort_order ASC);

-- Seed 3 default slides so the carousel works immediately
INSERT INTO hero_offers (sort_order, active, media_type, image_url, badge_text, title, subtitle, button_text, link_type, link_value, overlay_color)
VALUES
  (0, true, 'image',
   'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=1200',
   'NEW COLLECTION', 'Beauty That Makes You Shine',
   'Premium cosmetics loved by thousands worldwide',
   'Shop Now', 'page', '/(tabs)/products', 'rgba(10,5,7,0.50)'),
  (1, true, 'image',
   'https://images.pexels.com/photos/3373736/pexels-photo-3373736.jpeg?auto=compress&cs=tinysrgb&w=1200',
   'BESTSELLERS', 'Your Perfect Shade Awaits',
   'Discover our most-loved lipsticks & foundations',
   'Shop Bestsellers', 'category', 'lipstick', 'rgba(10,5,7,0.45)'),
  (2, true, 'image',
   'https://images.pexels.com/photos/1115128/pexels-photo-1115128.jpeg?auto=compress&cs=tinysrgb&w=1200',
   'LIMITED OFFER', 'Up to 30% Off This Week',
   'Exclusive deals on premium makeup essentials',
   'Explore Offers', 'page', '/(tabs)/products', 'rgba(10,5,7,0.55)');
