/*
  # Fix homepage_section_products: add sort_order column and complete RLS policies

  ## Problem
  1. The homepage_section_products table is missing a sort_order column.
     The admin UI reads and writes sort_order when adding/reordering products,
     causing all insert attempts to fail with a column-not-found error.

  2. The table only has SELECT and INSERT policies. DELETE and UPDATE policies
     are absent, so removing products and reordering them are silently blocked
     by RLS, meaning product assignments can never be removed or reordered.

  ## What this does
  1. Adds sort_order column (integer, default 0) if it doesn't exist.
  2. Backfills sort_order for existing rows using row_number ordered by created_at.
  3. Drops the overly-permissive INSERT policy (WITH CHECK true) and replaces it
     with an admin-only policy matching the pattern used by other admin tables.
  4. Adds admin-only DELETE policy.
  5. Adds admin-only UPDATE policy for reordering.
  6. Enables RLS on homepage_sections (it is currently off) and adds the full
     set of admin policies so section CRUD works correctly through adminSupabase().
*/

-- ── 1. Add sort_order to homepage_section_products ─────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'homepage_section_products' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE homepage_section_products ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Backfill existing rows with a stable order
UPDATE homepage_section_products sp
SET sort_order = sub.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY section_id ORDER BY created_at) AS rn
  FROM homepage_section_products
) sub
WHERE sp.id = sub.id AND sp.sort_order = 0;

-- ── 2. Fix homepage_section_products RLS policies ─────────────────────────────

-- Drop the open-to-all INSERT policy
DROP POLICY IF EXISTS "allow insert for all" ON homepage_section_products;

-- Replace with admin-only insert
CREATE POLICY "Admins can insert section products"
  ON homepage_section_products FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

-- Admin-only delete (was missing)
CREATE POLICY "Admins can delete section products"
  ON homepage_section_products FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- Admin-only update for sort_order reordering (was missing)
CREATE POLICY "Admins can update section products"
  ON homepage_section_products FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- ── 3. Enable RLS on homepage_sections and add admin policies ─────────────────

ALTER TABLE homepage_sections ENABLE ROW LEVEL SECURITY;

-- Public read (storefront needs to read sections)
CREATE POLICY "Public can read homepage sections"
  ON homepage_sections FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin write policies
CREATE POLICY "Admins can insert homepage sections"
  ON homepage_sections FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update homepage sections"
  ON homepage_sections FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete homepage sections"
  ON homepage_sections FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());
