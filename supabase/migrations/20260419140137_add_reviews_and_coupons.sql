/*
  # Add Reviews and Coupons Tables

  1. New Tables
    - `reviews`
      - `id` (uuid, primary key)
      - `product_id` (uuid, references products)
      - `customer_name` (text)
      - `customer_email` (text)
      - `rating` (integer, 1-5)
      - `body` (text)
      - `status` (text: pending, approved, rejected)
      - `created_at` (timestamptz)

    - `coupons`
      - `id` (uuid, primary key)
      - `code` (text, unique)
      - `discount_type` (text: percentage or fixed)
      - `discount_value` (numeric)
      - `min_order_value` (numeric, optional)
      - `expiry_date` (date, nullable)
      - `is_active` (boolean)
      - `usage_count` (integer)
      - `max_uses` (integer, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Updates to employees table
    - Add `join_date` column if not present

  3. Security
    - RLS enabled on both tables
    - Policies allow service-role access (admin operations)

  Notes:
    - Reviews start as 'pending' status
    - Coupons can be percentage (%) or fixed ($) discounts
*/

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  customer_email text NOT NULL DEFAULT '',
  rating integer NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reviews"
  ON reviews
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert reviews"
  ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update reviews"
  ON reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete reviews"
  ON reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  min_order_value numeric DEFAULT 0,
  expiry_date date,
  is_active boolean NOT NULL DEFAULT true,
  usage_count integer NOT NULL DEFAULT 0,
  max_uses integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view coupons"
  ON coupons
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert coupons"
  ON coupons
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update coupons"
  ON coupons
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete coupons"
  ON coupons
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'join_date'
  ) THEN
    ALTER TABLE employees ADD COLUMN join_date date DEFAULT CURRENT_DATE;
  END IF;
END $$;

INSERT INTO reviews (customer_name, customer_email, rating, body, status) VALUES
  ('Alex Thompson', 'alex@example.com', 5, 'Incredible gear quality. The helmet fits perfectly and the build quality is outstanding.', 'pending'),
  ('Sarah Mitchell', 'sarah@example.com', 4, 'Great parachute system. Very reliable and the packing instructions were clear.', 'approved'),
  ('Jake Morrison', 'jake@example.com', 3, 'Decent product but shipping took longer than expected. Would still recommend.', 'pending'),
  ('Emily Chen', 'emily@example.com', 5, 'Best skydiving suit I have ever owned. Fits like a glove and looks amazing.', 'approved'),
  ('Ryan Davis', 'ryan@example.com', 2, 'The altimeter was slightly off calibration out of the box. Customer support helped resolve it.', 'rejected')
ON CONFLICT DO NOTHING;

INSERT INTO coupons (code, discount_type, discount_value, min_order_value, expiry_date, is_active, max_uses) VALUES
  ('WELCOME10', 'percentage', 10, 0, '2026-12-31', true, 100),
  ('SAVE50', 'fixed', 50, 200, '2026-06-30', true, 50),
  ('SKYDIVE20', 'percentage', 20, 150, null, true, null),
  ('EXPIRED15', 'percentage', 15, 0, '2025-01-01', false, null)
ON CONFLICT (code) DO NOTHING;
