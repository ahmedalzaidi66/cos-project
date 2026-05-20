/*
  # Per-Shade Inventory Stock

  ## Summary
  Adds per-color/shade stock management so each shade of a product tracks its own
  inventory independently from the product-level stock.

  ## Changes

  ### product_shades
  - Added `stock` integer column (DEFAULT 0, NOT NULL)
    - Represents how many units of this specific shade are available.
    - Existing shades are backfilled to 0 (safe default — admin can then set real quantities).
  - Added `shade_id` column alias: order_items now stores `shade_id` uuid to link back.

  ### order_items
  - Added `shade_id` uuid nullable column referencing product_shades(id) ON DELETE SET NULL.
    This lets us trace exactly which shade was purchased, even if the shade is later renamed.

  ### DB Triggers / RPCs
  - `fn_decrement_shade_stock()`: AFTER INSERT on order_items — decrements the shade's stock
    by the ordered quantity when shade_id is set. Also decrements product.stock either way.
  - `fn_restore_shade_stock()`: Triggered AFTER UPDATE on orders when status transitions
    to 'cancelled' — restores shade stock + product stock for all line items of that order.

  ## Security
  - Trigger functions run as SECURITY DEFINER with fixed search_path (safe).
  - product_shades RLS: admin can UPDATE stock; public SELECT unchanged.
*/

-- ── 1. Add stock to product_shades ───────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_shades' AND column_name = 'stock'
  ) THEN
    ALTER TABLE product_shades ADD COLUMN stock integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── 2. Add shade_id to order_items ────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'shade_id'
  ) THEN
    ALTER TABLE order_items ADD COLUMN shade_id uuid REFERENCES product_shades(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_shade_id ON order_items (shade_id) WHERE shade_id IS NOT NULL;

-- ── 3. RLS: allow admin to update shade stock ──────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'product_shades' AND policyname = 'Admin can update product shades'
  ) THEN
    CREATE POLICY "Admin can update product shades"
      ON product_shades FOR UPDATE
      USING (is_admin_request())
      WITH CHECK (is_admin_request());
  END IF;
END $$;

-- ── 4. Stock decrement trigger on order_items INSERT ─────────────────────────
--  Decrements product_shades.stock (if shade_id set) AND products.stock for every order item.

CREATE OR REPLACE FUNCTION fn_decrement_shade_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Decrement shade-level stock when a specific shade was ordered
  IF NEW.shade_id IS NOT NULL THEN
    UPDATE product_shades
    SET stock = GREATEST(0, stock - NEW.quantity)
    WHERE id = NEW.shade_id;
  END IF;

  -- Always decrement product-level stock as well
  UPDATE products
  SET stock = GREATEST(0, stock - NEW.quantity)
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_shade_stock ON order_items;
CREATE TRIGGER trg_decrement_shade_stock
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_decrement_shade_stock();

-- ── 5. Stock restore trigger on orders UPDATE → 'cancelled' ──────────────────

CREATE OR REPLACE FUNCTION fn_restore_shade_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
BEGIN
  -- Only fire when transitioning INTO cancelled status
  IF OLD.status = NEW.status OR NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Restore stock for every line item in this order
  FOR item IN
    SELECT product_id, shade_id, quantity FROM order_items WHERE order_id = NEW.id
  LOOP
    -- Restore shade-level stock
    IF item.shade_id IS NOT NULL THEN
      UPDATE product_shades
      SET stock = stock + item.quantity
      WHERE id = item.shade_id;
    END IF;

    -- Restore product-level stock
    UPDATE products
    SET stock = stock + item.quantity
    WHERE id = item.product_id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_shade_stock ON orders;
CREATE TRIGGER trg_restore_shade_stock
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_restore_shade_stock();
