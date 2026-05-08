/*
  # Fix RLS Policies for Reviews, Products, and Coupons

  ## Problem
  - reviews: no anon SELECT policy → storefront cannot show approved reviews (testimonials section empty)
  - products: no INSERT/UPDATE/DELETE policies → admin panel cannot create, edit, or delete products
  - coupons: no anon SELECT policy → checkout cannot validate active coupon codes

  ## Changes

  ### 1. reviews table
  - Add SELECT policy for anon/authenticated: only approved reviews visible publicly

  ### 2. products table
  - Add INSERT policy for anon/authenticated (app uses anon key for all DB operations)
  - Add UPDATE policy for anon/authenticated
  - Add DELETE policy for anon/authenticated

  ### 3. coupons table
  - Add SELECT policy for anon/authenticated: only active coupons visible
*/

-- ─── reviews: storefront needs to read approved reviews ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reviews' AND policyname = 'Public can read approved reviews'
  ) THEN
    CREATE POLICY "Public can read approved reviews"
      ON reviews FOR SELECT
      TO anon, authenticated
      USING (status = 'approved');
  END IF;
END $$;

-- ─── products: admin needs insert/update/delete (app uses anon key) ───────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Anyone can insert products'
  ) THEN
    CREATE POLICY "Anyone can insert products"
      ON products FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Anyone can update products'
  ) THEN
    CREATE POLICY "Anyone can update products"
      ON products FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'Anyone can delete products'
  ) THEN
    CREATE POLICY "Anyone can delete products"
      ON products FOR DELETE
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- ─── coupons: storefront checkout needs to validate active coupons ────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'coupons' AND policyname = 'Public can read active coupons'
  ) THEN
    CREATE POLICY "Public can read active coupons"
      ON coupons FOR SELECT
      TO anon, authenticated
      USING (is_active = true);
  END IF;
END $$;
