/*
  # Create Wishlist Table

  1. New Table: `wishlist`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to auth.users — the logged-in Supabase auth user)
    - `product_id` (uuid, FK to products)
    - `created_at` (timestamptz)

  2. Constraints
    - UNIQUE on (user_id, product_id) — prevents duplicates
    - Index on user_id for fast per-user lookups
    - Index on product_id for referential lookups

  3. Security
    - RLS enabled
    - Users can only read/write their own wishlist rows
*/

CREATE TABLE IF NOT EXISTS wishlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS wishlist_user_id_idx     ON wishlist (user_id);
CREATE INDEX IF NOT EXISTS wishlist_product_id_idx  ON wishlist (product_id);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wishlist"
  ON wishlist FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into own wishlist"
  ON wishlist FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete from own wishlist"
  ON wishlist FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
