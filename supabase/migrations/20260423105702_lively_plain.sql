/*
  # Fix missing database schema elements

  1. New Tables
    - `ui_size_settings`
      - `id` (uuid, primary key)
      - `category` (text, unique)
      - `label` (text)
      - `mobile` (jsonb)
      - `tablet` (jsonb)
      - `desktop` (jsonb)
      - `updated_at` (timestamp)

  2. Schema Changes
    - Add `slug` column to `categories` table

  3. Security
    - Enable RLS on `ui_size_settings` table
    - Add policies for public read and authenticated write access
*/

-- Add missing slug column to categories table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'slug'
  ) THEN
    ALTER TABLE categories ADD COLUMN slug text;
  END IF;
END $$;

-- Update existing categories to have slugs based on their names
DO $$
DECLARE
  cat_record RECORD;
  generated_slug text;
BEGIN
  FOR cat_record IN 
    SELECT c.id, ct.name 
    FROM categories c
    LEFT JOIN category_translations ct ON c.id = ct.category_id AND ct.language = 'en'
    WHERE c.slug IS NULL
  LOOP
    -- Generate slug from English name, fallback to id
    IF cat_record.name IS NOT NULL THEN
      generated_slug := lower(regexp_replace(cat_record.name, '[^a-zA-Z0-9]+', '-', 'g'));
      generated_slug := trim(both '-' from generated_slug);
    ELSE
      generated_slug := 'category-' || substring(cat_record.id from 1 for 8);
    END IF;
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM categories WHERE slug = generated_slug) LOOP
      generated_slug := generated_slug || '-' || floor(random() * 1000)::text;
    END LOOP;
    
    UPDATE categories SET slug = generated_slug WHERE id = cat_record.id;
  END LOOP;
END $$;

-- Make slug column NOT NULL and add unique constraint
ALTER TABLE categories ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'categories' AND constraint_name = 'categories_slug_key'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Create ui_size_settings table
CREATE TABLE IF NOT EXISTS ui_size_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text UNIQUE NOT NULL,
  label text DEFAULT '' NOT NULL,
  mobile jsonb DEFAULT '{}' NOT NULL,
  tablet jsonb DEFAULT '{}' NOT NULL,
  desktop jsonb DEFAULT '{}' NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on ui_size_settings
ALTER TABLE ui_size_settings ENABLE ROW LEVEL SECURITY;

-- Add policies for ui_size_settings
CREATE POLICY "Anyone can read ui size settings"
  ON ui_size_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert ui size settings"
  ON ui_size_settings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update ui size settings"
  ON ui_size_settings
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default UI size settings
INSERT INTO ui_size_settings (category, label, mobile, tablet, desktop) VALUES
  ('global', 'Global', 
   '{"pageMaxWidth": 0, "horizontalPadding": 16, "verticalSpacing": 16, "sectionGap": 24, "borderRadiusScale": 1, "shadowIntensity": 1, "buttonRadius": 8, "cardRadius": 12}',
   '{"pageMaxWidth": 0, "horizontalPadding": 20, "verticalSpacing": 16, "sectionGap": 24, "borderRadiusScale": 1, "shadowIntensity": 1, "buttonRadius": 8, "cardRadius": 12}',
   '{"pageMaxWidth": 1280, "horizontalPadding": 24, "verticalSpacing": 24, "sectionGap": 32, "borderRadiusScale": 1, "shadowIntensity": 1, "buttonRadius": 8, "cardRadius": 12}'
  ),
  ('header', 'Header',
   '{"headerHeight": 72, "paddingLeft": 16, "paddingRight": 16, "logoWidth": 140, "logoHeight": 32, "iconSize": 22, "langSwitchSize": 22, "menuBtnSize": 22}',
   '{"headerHeight": 72, "paddingLeft": 16, "paddingRight": 16, "logoWidth": 140, "logoHeight": 32, "iconSize": 22, "langSwitchSize": 22, "menuBtnSize": 22}',
   '{"headerHeight": 80, "paddingLeft": 24, "paddingRight": 24, "logoWidth": 160, "logoHeight": 36, "iconSize": 22, "langSwitchSize": 22, "menuBtnSize": 22}'
  ),
  ('search', 'Search Bar',
   '{"barWidth": 100, "barHeight": 40, "iconSize": 16, "fontSize": 13, "borderRadius": 8, "marginTop": 8, "marginBottom": 4}',
   '{"barWidth": 100, "barHeight": 40, "iconSize": 16, "fontSize": 13, "borderRadius": 8, "marginTop": 8, "marginBottom": 4}',
   '{"barWidth": 100, "barHeight": 44, "iconSize": 16, "fontSize": 14, "borderRadius": 8, "marginTop": 8, "marginBottom": 4}'
  ),
  ('filter', 'Filter Buttons',
   '{"buttonHeight": 32, "paddingH": 12, "paddingV": 6, "fontSize": 12, "gap": 6, "borderRadius": 16}',
   '{"buttonHeight": 32, "paddingH": 12, "paddingV": 6, "fontSize": 12, "gap": 6, "borderRadius": 16}',
   '{"buttonHeight": 34, "paddingH": 14, "paddingV": 7, "fontSize": 13, "gap": 8, "borderRadius": 16}'
  ),
  ('product_card', 'Product Card',
   '{"columns": 2, "cardWidth": 0, "cardHeight": 0, "imageHeight": 160, "cardPadding": 8, "cardGap": 8, "titleFontSize": 13, "priceFontSize": 15, "ratingFontSize": 11, "addToCartBtnSize": 13}',
   '{"columns": 3, "cardWidth": 0, "cardHeight": 0, "imageHeight": 180, "cardPadding": 10, "cardGap": 10, "titleFontSize": 13, "priceFontSize": 15, "ratingFontSize": 11, "addToCartBtnSize": 13}',
   '{"columns": 4, "cardWidth": 0, "cardHeight": 0, "imageHeight": 200, "cardPadding": 12, "cardGap": 12, "titleFontSize": 14, "priceFontSize": 16, "ratingFontSize": 12, "addToCartBtnSize": 14}'
  ),
  ('bottom_nav', 'Bottom Nav',
   '{"navHeight": 60, "iconSize": 22, "labelFontSize": 10, "borderTopWidth": 1, "itemSpacing": 0}',
   '{"navHeight": 60, "iconSize": 22, "labelFontSize": 10, "borderTopWidth": 1, "itemSpacing": 0}',
   '{"navHeight": 64, "iconSize": 24, "labelFontSize": 11, "borderTopWidth": 1, "itemSpacing": 0}'
  )
ON CONFLICT (category) DO NOTHING;