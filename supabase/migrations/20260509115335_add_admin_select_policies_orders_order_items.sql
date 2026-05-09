/*
  # Add admin SELECT policies for orders, order_items, and customers

  ## Problem
  Admin dashboard was unable to read all orders/customers independently of any
  customer auth session. There were no RLS SELECT policies allowing admin token
  holders to read all rows — only customer-scoped policies existed.

  ## Changes

  ### orders table
  - Add "Admin can read all orders" SELECT policy using is_admin_request()

  ### order_items table
  - Add "Admin can read all order items" SELECT policy using is_admin_request()

  ### customers table
  - Policy "Admins can read all customers" already exists — no change needed

  ## Security
  - All new policies gate on is_admin_request() which verifies the x-admin-token
    header against bcrypt hashes in the employees table
  - Customer-scoped SELECT policies remain intact for the customer account page
*/

-- Admin SELECT on orders (all rows, no customer filter)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Admin can read all orders'
  ) THEN
    CREATE POLICY "Admin can read all orders"
      ON orders FOR SELECT
      TO anon, authenticated
      USING (is_admin_request());
  END IF;
END $$;

-- Admin SELECT on order_items (all rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items' AND policyname = 'Admin can read all order items'
  ) THEN
    CREATE POLICY "Admin can read all order items"
      ON order_items FOR SELECT
      TO anon, authenticated
      USING (is_admin_request());
  END IF;
END $$;
