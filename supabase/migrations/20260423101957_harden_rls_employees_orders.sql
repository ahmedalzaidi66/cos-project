/*
  # Harden RLS on employees, orders, and order_items

  ## Changes

  ### employees
  - Drop: "Anyone can read employees" (USING true — anon + authenticated)
  - Add: SELECT restricted to admin requests only (is_admin_request())
    Prevents anon users from listing employee records (names, emails, roles)

  ### orders
  - Drop: "Anon read orders by email filter" (USING true — exposes all orders to anon)
  - Authenticated users already have a correct scoped SELECT policy (customer_email = jwt email)
  - Anon INSERT policy is preserved — guest checkout must continue to work

  ### order_items
  - Drop: "Anon read order items" (USING true — exposes all order items to anon)
  - Authenticated users already have a correct scoped SELECT policy (via orders join)
  - Anon INSERT policy is preserved — guest checkout must continue to work

  ## Notes
  - No INSERT/UPDATE/DELETE policies are changed
  - Storefront checkout (anon INSERT on orders + order_items) is unaffected
  - Authenticated users can still read their own orders and order_items
*/

-- employees: drop open SELECT, add admin-only SELECT
DROP POLICY IF EXISTS "Anyone can read employees" ON employees;

CREATE POLICY "Admin can read employees"
  ON employees
  FOR SELECT
  TO anon, authenticated
  USING (is_admin_request());

-- orders: drop open anon SELECT (authenticated scoped policy already exists)
DROP POLICY IF EXISTS "Anon read orders by email filter" ON orders;

-- order_items: drop open anon SELECT (authenticated scoped policy already exists)
DROP POLICY IF EXISTS "Anon read order items" ON order_items;
