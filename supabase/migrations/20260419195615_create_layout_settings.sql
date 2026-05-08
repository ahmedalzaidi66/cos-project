/*
  # Create Layout Settings Table

  ## Purpose
  Stores per-section layout and spacing settings that admins can edit from the dashboard.
  Settings are loaded dynamically on the homepage so spacing, typography, and layout
  values are never hardcoded.

  ## New Tables
  - `layout_settings`
    - `id` (uuid, primary key)
    - `section_id` (text, unique) — identifier matching homepage sections: header, hero, featured, canopy, testimonials, banner, footer, products
    - `label` (text) — human-friendly section name
    - `mobile` (jsonb) — mobile spacing/layout overrides
    - `tablet` (jsonb) — tablet spacing/layout overrides
    - `desktop` (jsonb) — desktop spacing/layout overrides
    - `typography` (jsonb) — heading/subtitle/button sizing and spacing
    - `layout` (jsonb) — alignment, grid columns, content width, hero height etc.
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users (admins) can read and write all rows
  - Public (anon) can read all rows so the storefront can load settings
*/

CREATE TABLE IF NOT EXISTS layout_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id text UNIQUE NOT NULL,
  label text NOT NULL DEFAULT '',
  mobile jsonb NOT NULL DEFAULT '{}',
  tablet jsonb NOT NULL DEFAULT '{}',
  desktop jsonb NOT NULL DEFAULT '{}',
  typography jsonb NOT NULL DEFAULT '{}',
  layout jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE layout_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read layout settings"
  ON layout_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert layout settings"
  ON layout_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update layout settings"
  ON layout_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed default settings for all homepage sections
INSERT INTO layout_settings (section_id, label, mobile, tablet, desktop, typography, layout)
VALUES
  (
    'hero',
    'Hero Banner',
    '{"marginTop":0,"marginBottom":0,"paddingTop":0,"paddingBottom":0,"paddingLeft":0,"paddingRight":0,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":0,"paddingBottom":0,"paddingLeft":0,"paddingRight":0,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":0,"paddingBottom":0,"paddingLeft":0,"paddingRight":0,"maxWidth":0,"borderRadius":0}',
    '{"headingSize":32,"headingMarginBottom":6,"subtitleSize":13,"subtitleMarginBottom":0,"buttonSize":15,"buttonPaddingH":24,"buttonPaddingV":12,"cardGap":8}',
    '{"heroHeight":220,"alignment":"left","contentWidth":100,"imageAspectRatio":0}'
  ),
  (
    'header',
    'Header',
    '{"marginTop":0,"marginBottom":0,"paddingTop":0,"paddingBottom":0,"paddingLeft":16,"paddingRight":16,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":0,"paddingBottom":0,"paddingLeft":16,"paddingRight":16,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":0,"paddingBottom":0,"paddingLeft":24,"paddingRight":24,"maxWidth":1200,"borderRadius":0}',
    '{"headingSize":18,"headingMarginBottom":0,"subtitleSize":11,"subtitleMarginBottom":0,"buttonSize":13,"buttonPaddingH":12,"buttonPaddingV":8,"cardGap":8}',
    '{"heroHeight":0,"alignment":"left","contentWidth":100,"imageAspectRatio":0}'
  ),
  (
    'featured',
    'Featured Products',
    '{"marginTop":0,"marginBottom":0,"paddingTop":8,"paddingBottom":8,"paddingLeft":16,"paddingRight":16,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":8,"paddingBottom":8,"paddingLeft":16,"paddingRight":16,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":16,"paddingBottom":16,"paddingLeft":24,"paddingRight":24,"maxWidth":1200,"borderRadius":0}',
    '{"headingSize":18,"headingMarginBottom":4,"subtitleSize":13,"subtitleMarginBottom":8,"buttonSize":14,"buttonPaddingH":16,"buttonPaddingV":8,"cardGap":8}',
    '{"heroHeight":0,"alignment":"left","contentWidth":100,"imageAspectRatio":1,"gridColumns":2,"cardGap":8}'
  ),
  (
    'canopy',
    'Canopy Finder',
    '{"marginTop":24,"marginBottom":24,"paddingTop":32,"paddingBottom":32,"paddingLeft":16,"paddingRight":16,"maxWidth":0,"borderRadius":16}',
    '{"marginTop":24,"marginBottom":24,"paddingTop":32,"paddingBottom":32,"paddingLeft":24,"paddingRight":24,"maxWidth":0,"borderRadius":16}',
    '{"marginTop":32,"marginBottom":32,"paddingTop":40,"paddingBottom":40,"paddingLeft":32,"paddingRight":32,"maxWidth":800,"borderRadius":16}',
    '{"headingSize":22,"headingMarginBottom":8,"subtitleSize":13,"subtitleMarginBottom":12,"buttonSize":15,"buttonPaddingH":24,"buttonPaddingV":12,"cardGap":8}',
    '{"heroHeight":0,"alignment":"center","contentWidth":100,"imageAspectRatio":0}'
  ),
  (
    'testimonials',
    'Testimonials',
    '{"marginTop":0,"marginBottom":0,"paddingTop":24,"paddingBottom":24,"paddingLeft":0,"paddingRight":0,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":24,"paddingBottom":24,"paddingLeft":0,"paddingRight":0,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":32,"paddingBottom":32,"paddingLeft":0,"paddingRight":0,"maxWidth":0,"borderRadius":0}',
    '{"headingSize":18,"headingMarginBottom":4,"subtitleSize":13,"subtitleMarginBottom":12,"buttonSize":13,"buttonPaddingH":12,"buttonPaddingV":8,"cardGap":8}',
    '{"heroHeight":0,"alignment":"left","contentWidth":200,"imageAspectRatio":0,"cardGap":8}'
  ),
  (
    'banner',
    'Promo Banner',
    '{"marginTop":0,"marginBottom":0,"paddingTop":10,"paddingBottom":10,"paddingLeft":16,"paddingRight":16,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":10,"paddingBottom":10,"paddingLeft":16,"paddingRight":16,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":10,"paddingBottom":10,"paddingLeft":24,"paddingRight":24,"maxWidth":0,"borderRadius":0}',
    '{"headingSize":13,"headingMarginBottom":0,"subtitleSize":11,"subtitleMarginBottom":0,"buttonSize":13,"buttonPaddingH":12,"buttonPaddingV":6,"cardGap":8}',
    '{"heroHeight":0,"alignment":"center","contentWidth":100,"imageAspectRatio":0}'
  ),
  (
    'footer',
    'Footer',
    '{"marginTop":0,"marginBottom":0,"paddingTop":32,"paddingBottom":32,"paddingLeft":16,"paddingRight":16,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":32,"paddingBottom":32,"paddingLeft":16,"paddingRight":16,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":48,"paddingBottom":48,"paddingLeft":24,"paddingRight":24,"maxWidth":1200,"borderRadius":0}',
    '{"headingSize":15,"headingMarginBottom":12,"subtitleSize":13,"subtitleMarginBottom":4,"buttonSize":13,"buttonPaddingH":12,"buttonPaddingV":8,"cardGap":8}',
    '{"heroHeight":0,"alignment":"left","contentWidth":100,"imageAspectRatio":0,"gridColumns":3}'
  ),
  (
    'products',
    'Product Grid',
    '{"marginTop":0,"marginBottom":0,"paddingTop":0,"paddingBottom":48,"paddingLeft":16,"paddingRight":16,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":0,"paddingBottom":48,"paddingLeft":16,"paddingRight":16,"maxWidth":0,"borderRadius":0}',
    '{"marginTop":0,"marginBottom":0,"paddingTop":0,"paddingBottom":48,"paddingLeft":24,"paddingRight":24,"maxWidth":1200,"borderRadius":0}',
    '{"headingSize":15,"headingMarginBottom":4,"subtitleSize":11,"subtitleMarginBottom":0,"buttonSize":13,"buttonPaddingH":12,"buttonPaddingV":8,"cardGap":8}',
    '{"heroHeight":0,"alignment":"left","contentWidth":100,"imageAspectRatio":1,"gridColumns":2,"cardGap":8}'
  )
ON CONFLICT (section_id) DO NOTHING;
