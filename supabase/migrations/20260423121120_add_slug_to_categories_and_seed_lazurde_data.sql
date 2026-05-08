/*
  # Add slug column to categories and seed Lazurde Makeup data

  1. Modified Tables
    - `categories`
      - Add `slug` column (text, unique) for URL-friendly category identifiers

  2. New Data
    - Seed 5 categories: Makeup, Skincare, Haircare, Fragrances, Tools
    - Seed category translations for English
    - Seed 4 cosmetics products: Lipstick, Foundation, Eyeshadow Palette, Mascara
    - Seed product translations for English

  3. Notes
    - Uses IF NOT EXISTS checks to prevent duplicate entries
    - Products are marked as featured and active
*/

-- Add slug column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'slug'
  ) THEN
    ALTER TABLE categories ADD COLUMN slug text UNIQUE;
  END IF;
END $$;

-- Insert categories
INSERT INTO categories (id, slug, image, active) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'makeup', '', true),
  ('a0000000-0000-0000-0000-000000000002', 'skincare', '', true),
  ('a0000000-0000-0000-0000-000000000003', 'haircare', '', true),
  ('a0000000-0000-0000-0000-000000000004', 'fragrances', '', true),
  ('a0000000-0000-0000-0000-000000000005', 'tools', '', true)
ON CONFLICT (id) DO NOTHING;

-- Insert category translations (English)
INSERT INTO category_translations (category_id, language, name, description) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'en', 'Makeup', 'Lipsticks, foundations, and more'),
  ('a0000000-0000-0000-0000-000000000002', 'en', 'Skincare', 'Cleansers, moisturizers, and serums'),
  ('a0000000-0000-0000-0000-000000000003', 'en', 'Haircare', 'Shampoos, conditioners, and treatments'),
  ('a0000000-0000-0000-0000-000000000004', 'en', 'Fragrances', 'Perfumes and body mists'),
  ('a0000000-0000-0000-0000-000000000005', 'en', 'Tools', 'Brushes, sponges, and accessories')
ON CONFLICT DO NOTHING;

-- Insert cosmetics products
INSERT INTO products (id, name, price, category, rating, review_count, description, main_image, stock, badge, featured, status, sku) VALUES
  (
    'b0000000-0000-0000-0000-000000000001',
    'Velvet Matte Lipstick',
    24.99,
    'makeup',
    4.8,
    142,
    'Long-lasting velvet matte finish in a rich berry shade. Hydrating formula with vitamin E keeps lips smooth all day.',
    'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=800',
    85,
    'BEST SELLER',
    true,
    'active',
    'LM-LIP-001'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'Silk Glow Foundation',
    38.99,
    'makeup',
    4.6,
    98,
    'Lightweight, buildable coverage foundation with a natural satin finish. Infused with hyaluronic acid for all-day hydration.',
    'https://images.pexels.com/photos/3373739/pexels-photo-3373739.jpeg?auto=compress&cs=tinysrgb&w=800',
    60,
    'NEW',
    true,
    'active',
    'LM-FND-001'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    'Luxe Eyeshadow Palette',
    42.00,
    'makeup',
    4.9,
    215,
    '12-shade eyeshadow palette with buttery mattes and shimmering metallics. Highly pigmented, blendable, and long-wearing.',
    'https://images.pexels.com/photos/3685530/pexels-photo-3685530.jpeg?auto=compress&cs=tinysrgb&w=800',
    45,
    'TOP RATED',
    true,
    'active',
    'LM-EYE-001'
  ),
  (
    'b0000000-0000-0000-0000-000000000004',
    'Dramatic Volume Mascara',
    18.50,
    'makeup',
    4.7,
    176,
    'Volumizing and lengthening mascara with a unique hourglass wand. Smudge-proof and clump-free for dramatic lashes.',
    'https://images.pexels.com/photos/2587370/pexels-photo-2587370.jpeg?auto=compress&cs=tinysrgb&w=800',
    120,
    'SALE',
    true,
    'active',
    'LM-MAS-001'
  )
ON CONFLICT (id) DO NOTHING;