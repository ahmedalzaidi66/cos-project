/*
  # Add Soft Delete to Products, Categories, and Employees

  ## Summary
  Adds safe soft delete support to the three most critical admin entities.
  Instead of permanently removing records on delete, rows are flagged with
  deleted_at / deleted_by / is_deleted.  Normal queries filter these out.
  Super Admins can see, restore, or permanently hard-delete soft-deleted rows.

  ## Changes

  ### products
  - Add `is_deleted` (boolean, DEFAULT false)
  - Add `deleted_at` (timestamptz, nullable)
  - Add `deleted_by` (text, nullable) — stores admin email

  ### categories
  - Add `is_deleted` (boolean, DEFAULT false)
  - Add `deleted_at` (timestamptz, nullable)
  - Add `deleted_by` (text, nullable)

  ### employees
  - Add `is_deleted` (boolean, DEFAULT false)
  - Add `deleted_at` (timestamptz, nullable)
  - Add `deleted_by` (text, nullable)

  ## RLS Policy Updates

  ### products
  - Public SELECT: restrict to `is_deleted = false` (was `true`, meaning anyone could read all rows)
  - Admin SELECT: allow reading all rows including deleted ones

  ### categories
  - Public SELECT already restricts to `active = true`; add `is_deleted = false`

  ### employees
  - Admin SELECT / employee self-read: unchanged (admins may view deleted employees for audit)

  ## Notes
  - Existing hard-delete RLS policies are kept so Super Admin can still physically remove rows when needed
  - No existing data is modified
  - Indexes added on is_deleted for query performance
*/

-- ── products ──────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE products ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE products ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE products ADD COLUMN deleted_by text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS products_is_deleted_idx ON products (is_deleted);

-- Update public SELECT policy to exclude soft-deleted rows
DROP POLICY IF EXISTS "Anyone can read products" ON products;
CREATE POLICY "Public can read active products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (is_deleted = false);

-- Add admin SELECT policy so admins can see all products including deleted ones
DROP POLICY IF EXISTS "Admins can read all products" ON products;
CREATE POLICY "Admins can read all products"
  ON products FOR SELECT
  TO anon
  USING (is_admin_request());

-- ── categories ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE categories ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE categories ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE categories ADD COLUMN deleted_by text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS categories_is_deleted_idx ON categories (is_deleted);

-- Update public SELECT policy: also exclude soft-deleted categories
DROP POLICY IF EXISTS "Public can read categories" ON categories;
CREATE POLICY "Public can read active categories"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (active = true AND is_deleted = false);

-- Add admin SELECT policy so admins can see all categories including deleted
DROP POLICY IF EXISTS "Admins can read all categories" ON categories;
CREATE POLICY "Admins can read all categories"
  ON categories FOR SELECT
  TO anon
  USING (is_admin_request());

-- ── employees ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE employees ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE employees ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE employees ADD COLUMN deleted_by text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS employees_is_deleted_idx ON employees (is_deleted);

-- Employees table admin SELECT already allows all rows via is_admin_request()
-- The employee self-read policy uses auth_user_id which stays valid for active employees
-- No policy changes needed for employees — admins already see all rows
