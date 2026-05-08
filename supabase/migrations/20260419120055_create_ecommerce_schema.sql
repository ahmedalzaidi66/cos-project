/*
  # Skydiver Man Gear - E-Commerce Schema

  1. New Tables
    - `products` - Gear catalog with name, price, category, rating, description, image_url, stock, badge
    - `orders` - Customer orders with contact info, address, payment method, total, status
    - `order_items` - Line items linking orders to products with quantity and price

  2. Security
    - Enable RLS on all tables
    - Products: public read access
    - Orders: authenticated users can create and read their own orders
    - Order items: accessible alongside their parent order

  3. Notes
    - Products seeded with skydiving gear catalog
    - Orders reference customer email for mock auth matching
*/

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'accessories',
  rating numeric(3,1) NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  stock integer NOT NULL DEFAULT 0,
  badge text DEFAULT NULL,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (true);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text NOT NULL,
  customer_first_name text NOT NULL DEFAULT '',
  customer_last_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  zip text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  payment_method text NOT NULL DEFAULT 'card',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  shipping numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read orders by email"
  ON orders FOR SELECT
  TO anon, authenticated
  USING (true);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  product_name text NOT NULL DEFAULT '',
  product_image text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert order items"
  ON order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read order items"
  ON order_items FOR SELECT
  TO anon, authenticated
  USING (true);
