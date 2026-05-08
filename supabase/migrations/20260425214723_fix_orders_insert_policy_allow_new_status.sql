/*
  # Fix orders INSERT policy to allow 'new' status

  ## Problem
  The existing INSERT policy requires status = 'confirmed', but checkout now
  submits orders with status = 'new' (for Cash on Delivery), causing an RLS violation.

  ## Changes
  - Drop the old INSERT policy that hard-coded status = 'confirmed'
  - Create a new INSERT policy that allows both 'new' and 'confirmed' statuses
  - Still requires customer_email to be non-empty and total >= 0
  - Applies to both anon and authenticated roles (guest checkout)
*/

DROP POLICY IF EXISTS "Guest can insert orders with valid data" ON orders;

CREATE POLICY "Anyone can insert orders with valid data"
  ON orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status IN ('new', 'confirmed', 'pending')
    AND customer_email IS NOT NULL
    AND customer_email <> ''
    AND total >= 0
  );
