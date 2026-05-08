/*
  # Add UI Size Settings Table

  ## Purpose
  Stores granular component-level size and spacing settings that admins can control
  from the dashboard without editing code. Covers global page sizing, header, search bar,
  filter buttons, product cards, and bottom navigation — per breakpoint (mobile/tablet/desktop).

  ## New Tables
  - `ui_size_settings`
    - `id` (uuid, primary key)
    - `category` (text, unique) — one of: global, header, search, filter, product_card, bottom_nav
    - `label` (text) — human-friendly category name
    - `mobile` (jsonb) — mobile values
    - `tablet` (jsonb) — tablet values
    - `desktop` (jsonb) — desktop values
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - anon and authenticated roles can SELECT (storefront reads settings)
  - anon and authenticated roles can INSERT/UPDATE (custom admin bypasses Supabase Auth)

  ## Categories and Fields
  - global: pageMaxWidth, horizontalPadding, verticalSpacing, sectionGap, borderRadiusScale, shadowIntensity, buttonRadius, cardRadius
  - header: headerHeight, paddingLeft, paddingRight, logoWidth, logoHeight, iconSize, langSwitchSize, menuBtnSize
  - search: barWidth, barHeight, iconSize, fontSize, borderRadius, marginTop, marginBottom
  - filter: buttonHeight, paddingH, paddingV, fontSize, gap, borderRadius
  - product_card: columns, cardWidth, cardHeight, imageHeight, cardPadding, cardGap, titleFontSize, priceFontSize, ratingFontSize, addToCartBtnSize
  - bottom_nav: navHeight, iconSize, labelFontSize, borderTopWidth, itemSpacing
*/

CREATE TABLE IF NOT EXISTS ui_size_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text UNIQUE NOT NULL,
  label text NOT NULL DEFAULT '',
  mobile jsonb NOT NULL DEFAULT '{}',
  tablet jsonb NOT NULL DEFAULT '{}',
  desktop jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ui_size_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ui size settings"
  ON ui_size_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert ui size settings"
  ON ui_size_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update ui size settings"
  ON ui_size_settings FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO ui_size_settings (category, label, mobile, tablet, desktop) VALUES
(
  'global',
  'Global',
  '{"pageMaxWidth":0,"horizontalPadding":16,"verticalSpacing":16,"sectionGap":24,"borderRadiusScale":1,"shadowIntensity":1,"buttonRadius":8,"cardRadius":12}',
  '{"pageMaxWidth":0,"horizontalPadding":20,"verticalSpacing":16,"sectionGap":24,"borderRadiusScale":1,"shadowIntensity":1,"buttonRadius":8,"cardRadius":12}',
  '{"pageMaxWidth":1280,"horizontalPadding":24,"verticalSpacing":24,"sectionGap":32,"borderRadiusScale":1,"shadowIntensity":1,"buttonRadius":8,"cardRadius":12}'
),
(
  'header',
  'Header',
  '{"headerHeight":72,"paddingLeft":16,"paddingRight":16,"logoWidth":140,"logoHeight":32,"iconSize":22,"langSwitchSize":22,"menuBtnSize":22}',
  '{"headerHeight":72,"paddingLeft":16,"paddingRight":16,"logoWidth":140,"logoHeight":32,"iconSize":22,"langSwitchSize":22,"menuBtnSize":22}',
  '{"headerHeight":80,"paddingLeft":24,"paddingRight":24,"logoWidth":160,"logoHeight":36,"iconSize":22,"langSwitchSize":22,"menuBtnSize":22}'
),
(
  'search',
  'Search Bar',
  '{"barWidth":100,"barHeight":40,"iconSize":16,"fontSize":13,"borderRadius":8,"marginTop":8,"marginBottom":4}',
  '{"barWidth":100,"barHeight":40,"iconSize":16,"fontSize":13,"borderRadius":8,"marginTop":8,"marginBottom":4}',
  '{"barWidth":100,"barHeight":44,"iconSize":16,"fontSize":14,"borderRadius":8,"marginTop":8,"marginBottom":4}'
),
(
  'filter',
  'Filter Buttons',
  '{"buttonHeight":32,"paddingH":12,"paddingV":6,"fontSize":12,"gap":6,"borderRadius":8}',
  '{"buttonHeight":32,"paddingH":12,"paddingV":6,"fontSize":12,"gap":6,"borderRadius":8}',
  '{"buttonHeight":34,"paddingH":14,"paddingV":7,"fontSize":13,"gap":8,"borderRadius":8}'
),
(
  'product_card',
  'Product Card',
  '{"columns":2,"cardWidth":0,"cardHeight":0,"imageHeight":160,"cardPadding":10,"cardGap":8,"titleFontSize":13,"priceFontSize":15,"ratingFontSize":11,"addToCartBtnSize":13}',
  '{"columns":3,"cardWidth":0,"cardHeight":0,"imageHeight":180,"cardPadding":12,"cardGap":10,"titleFontSize":13,"priceFontSize":15,"ratingFontSize":11,"addToCartBtnSize":13}',
  '{"columns":4,"cardWidth":0,"cardHeight":0,"imageHeight":200,"cardPadding":14,"cardGap":12,"titleFontSize":14,"priceFontSize":16,"ratingFontSize":12,"addToCartBtnSize":14}'
),
(
  'bottom_nav',
  'Bottom Nav',
  '{"navHeight":60,"iconSize":22,"labelFontSize":10,"borderTopWidth":1,"itemSpacing":0}',
  '{"navHeight":60,"iconSize":22,"labelFontSize":10,"borderTopWidth":1,"itemSpacing":0}',
  '{"navHeight":64,"iconSize":24,"labelFontSize":11,"borderTopWidth":1,"itemSpacing":0}'
)
ON CONFLICT (category) DO NOTHING;
