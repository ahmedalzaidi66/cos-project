/*
  # Add availability controls for products and shades

  ## Summary
  Adds explicit availability flags so admins can toggle products and individual
  shades in/out of stock without changing the numeric stock count.

  ## Changes

  ### products table
  - New column `in_stock` (boolean, NOT NULL, DEFAULT true)
    - true  → product is available for purchase
    - false → product is blocked: "Out of Stock" badge shown everywhere,
              Add to Cart disabled, cart/checkout blocked

  ### product_shades table
  - New column `is_available` (boolean, NOT NULL, DEFAULT true)
    - true  → shade can be selected and added to cart
    - false → shade shows "Out of Stock" indicator, cannot be selected

  ## Security
  - Existing RLS policies cover these columns automatically (column-level,
    no row-level change needed).
  - Admin can update via the x-admin-token path (existing is_admin_request() check).
  - Storefront reads are already public-read via existing SELECT policies.

  ## Notes
  - All existing products/shades default to in_stock=true / is_available=true
    so no existing data is broken.
  - The numeric `stock` column is preserved for low-stock warnings; `in_stock`
    is a separate admin override toggle.
*/

-- products: add in_stock flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'in_stock'
  ) THEN
    ALTER TABLE products ADD COLUMN in_stock boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- product_shades: add is_available flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_shades' AND column_name = 'is_available'
  ) THEN
    ALTER TABLE product_shades ADD COLUMN is_available boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Index for fast storefront filter (only needed if you ever filter by in_stock in queries)
CREATE INDEX IF NOT EXISTS idx_products_in_stock
  ON products (in_stock)
  WHERE in_stock = false;
