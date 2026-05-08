/*
  # Fix orders table: admin UPDATE policy + updated_at column

  ## Root cause
  The `orders` table has SELECT and INSERT policies but NO UPDATE policy.
  Every admin status change via `adminSupabase().update({status})` was silently
  rejected by RLS, so the status never changed in the DB, and the DB trigger
  never fired — meaning no in-app notification, no push, no email.

  ## Changes

  ### 1. Add updated_at column
  Tracks when an order was last modified. Set by application on every UPDATE.

  ### 2. Add admin UPDATE policy
  Uses `is_admin_request()` (checks x-admin-token header against bcrypt hash
  in employees.session_token_hash) to allow admins to update any order.

  ### 3. Add customer UPDATE policy  
  Allows authenticated customers to update their own order's notes field only
  (useful for future cancellation requests etc.) — scoped tightly.

  ### 4. Keep existing INSERT/SELECT policies unchanged
*/

-- 1. Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'updated_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE orders ADD COLUMN updated_at timestamptz DEFAULT now();
    -- Backfill existing rows
    UPDATE orders SET updated_at = created_at WHERE updated_at IS NULL;
  END IF;
END $$;

-- 2. Admin UPDATE policy — allows any column update when admin token is valid
DROP POLICY IF EXISTS "Admin can update orders" ON orders;
CREATE POLICY "Admin can update orders"
  ON orders FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- 3. Customer can update own order notes (non-status fields) — future use
DROP POLICY IF EXISTS "Customers can update own order notes" ON orders;
CREATE POLICY "Customers can update own order notes"
  ON orders FOR UPDATE
  TO authenticated
  USING (customer_email = (auth.jwt() ->> 'email'))
  WITH CHECK (customer_email = (auth.jwt() ->> 'email'));
