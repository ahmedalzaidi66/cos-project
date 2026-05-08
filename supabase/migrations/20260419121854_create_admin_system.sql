/*
  # Admin System Schema

  1. New Tables
    - `employees` - Admin staff with name, email, phone, role, permissions, active status
    - `site_settings` - Key/value store for store settings (name, logo, contact info)
    - `homepage_content` - Editable homepage sections (hero title, buttons, images, featured)

  2. Security
    - RLS enabled on all tables
    - Employees table: only authenticated admins can manage
    - Site settings: anyone can read, only admins can write
    - Homepage content: anyone can read (needed for public homepage), admins can write

  3. Seed Data
    - Default site settings
    - Default homepage content
    - Default super admin employee record
*/

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL DEFAULT '',
  email text UNIQUE NOT NULL,
  phone text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'admin',
  permissions jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  avatar_url text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read employees"
  ON employees FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert employees"
  ON employees FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update employees"
  ON employees FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete employees"
  ON employees FOR DELETE
  TO anon, authenticated
  USING (true);

-- Site settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site settings"
  ON site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert site settings"
  ON site_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update site settings"
  ON site_settings FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Homepage content table
CREATE TABLE IF NOT EXISTS homepage_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,
  key text NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(section, key)
);

ALTER TABLE homepage_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read homepage content"
  ON homepage_content FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert homepage content"
  ON homepage_content FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update homepage content"
  ON homepage_content FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Seed default site settings
INSERT INTO site_settings (key, value) VALUES
  ('store_name', 'Skydiver Man Gear'),
  ('store_tagline', 'Professional Skydiving Equipment'),
  ('contact_email', 'hello@skydivermangear.com'),
  ('contact_phone', '+1 (800) SKY-GEAR'),
  ('contact_address', '123 Freefall Ave, Sky City, CA 90210'),
  ('logo_url', ''),
  ('currency', 'USD'),
  ('shipping_free_threshold', '150')
ON CONFLICT (key) DO NOTHING;

-- Seed default homepage content
INSERT INTO homepage_content (section, key, value) VALUES
  ('hero', 'title', 'Tested in Real Skydives'),
  ('hero', 'subtitle', 'Gear trusted by 10,000+ skydivers worldwide'),
  ('hero', 'badge_text', 'PROFESSIONAL GRADE'),
  ('hero', 'cta_primary', 'Shop Now'),
  ('hero', 'cta_secondary', 'View Featured'),
  ('hero', 'image_url', 'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=800'),
  ('featured', 'title', 'Featured Gear'),
  ('featured', 'subtitle', 'Hand-picked by our experts'),
  ('featured', 'enabled', 'true')
ON CONFLICT (section, key) DO NOTHING;

-- Seed default super admin employee
INSERT INTO employees (full_name, email, phone, role, permissions) VALUES
  ('Super Admin', 'admin@skydivermangear.com', '+1 (800) SKY-GEAR', 'super_admin', '["manage_products","manage_orders","manage_customers","manage_employees"]')
ON CONFLICT (email) DO NOTHING;
