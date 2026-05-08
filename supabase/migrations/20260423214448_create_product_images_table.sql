/*
  # Create product_images table for gallery persistence

  1. New Tables
    - `product_images`
      - `id` (uuid, primary key)
      - `product_id` (uuid, references products, cascade delete)
      - `url` (text, image URL)
      - `is_main` (boolean, primary image flag)
      - `sort_order` (integer, display order)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `product_images` table
    - Policies match products table pattern (admin token validated at app layer)

  3. Backfill
    - Creates a product_images row for every existing product that has
      a main_image or image_url, so existing products show in gallery
*/

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url text NOT NULL DEFAULT '',
  is_main boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_sort ON product_images(product_id, sort_order);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read product images"
  ON product_images FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert product images"
  ON product_images FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update product images"
  ON product_images FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete product images"
  ON product_images FOR DELETE
  TO anon, authenticated
  USING (true);

-- Backfill existing products into product_images
INSERT INTO product_images (product_id, url, is_main, sort_order)
SELECT
  p.id,
  COALESCE(NULLIF(p.main_image, ''), NULLIF(p.image_url, '')),
  true,
  0
FROM products p
WHERE COALESCE(NULLIF(p.main_image, ''), NULLIF(p.image_url, '')) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
  );
