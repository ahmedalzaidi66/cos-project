/*
  # Create product_shades table for shade/color variants

  1. New Tables
    - `product_shades`
      - `id` (uuid, primary key)
      - `product_id` (uuid, references products, cascade delete)
      - `name` (text, shade name e.g. "001 Mocha Glow")
      - `color_hex` (text, hex color e.g. "#8B5E3C")
      - `shade_image` (text, swatch/thumbnail image URL)
      - `product_image` (text, full product image when this shade is selected)
      - `sort_order` (integer, display order)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `product_shades` table
    - Policies match products table pattern
*/

CREATE TABLE IF NOT EXISTS product_shades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  color_hex text NOT NULL DEFAULT '#000000',
  shade_image text NOT NULL DEFAULT '',
  product_image text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_shades_product_id ON product_shades(product_id);
CREATE INDEX IF NOT EXISTS idx_product_shades_sort ON product_shades(product_id, sort_order);

ALTER TABLE product_shades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read product shades"
  ON product_shades FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert product shades"
  ON product_shades FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update product shades"
  ON product_shades FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete product shades"
  ON product_shades FOR DELETE
  TO anon, authenticated
  USING (true);
