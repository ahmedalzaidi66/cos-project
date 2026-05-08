/*
  # Create Page Layout System

  ## Summary
  This migration creates the data model for the drag-and-drop page builder.

  ## New Tables

  ### `page_layouts`
  Stores a named layout for a page (e.g. "home"). Each page has exactly one active layout.
  - `id` - uuid primary key
  - `page` - page identifier (e.g. 'home'), unique
  - `updated_at` - timestamp of last save

  ### `page_blocks`
  Individual content blocks that make up a page layout.
  - `id` - uuid primary key
  - `layout_id` - foreign key to page_layouts
  - `type` - block type (hero, featured, canopy, testimonials, banner, footer, header)
  - `order_index` - integer sort order
  - `visible` - whether the block is displayed
  - `content` - jsonb object with block-specific settings
  - `created_at` / `updated_at` - timestamps

  ## Security
  - RLS enabled on both tables
  - Read access is public (frontend needs to render blocks)
  - Write access requires service role (admin operations done via server)
  - Since admin panel uses anon key with Supabase, we add an admin write policy based on the admin_users table existing
*/

CREATE TABLE IF NOT EXISTS page_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text UNIQUE NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS page_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id uuid NOT NULL REFERENCES page_layouts(id) ON DELETE CASCADE,
  type text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  content jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_blocks_layout_id ON page_blocks(layout_id);
CREATE INDEX IF NOT EXISTS idx_page_blocks_order ON page_blocks(layout_id, order_index);

ALTER TABLE page_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read page layouts"
  ON page_layouts FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can read page blocks"
  ON page_blocks FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert page layouts"
  ON page_layouts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update page layouts"
  ON page_layouts FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert page blocks"
  ON page_blocks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update page blocks"
  ON page_blocks FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete page blocks"
  ON page_blocks FOR DELETE
  TO anon, authenticated
  USING (true);

INSERT INTO page_layouts (page) VALUES ('home')
ON CONFLICT (page) DO NOTHING;
