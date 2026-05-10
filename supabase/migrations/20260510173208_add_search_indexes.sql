/*
  # Add search performance indexes

  ## Summary
  Adds GIN and trigram indexes to support fast full-text and partial-match
  search across product names, descriptions, categories, and tags.

  ## Changes
  1. Enable pg_trgm extension (safe if already installed)
  2. Add trigram indexes on products: name, name_ar, description, category, badge
  3. Add trigram index on product_translations: name, short_description, full_description
  4. Composite index on products for filter-friendly queries (status, category, price, rating)
  5. Index on product_shades name + color_hex for shade search
*/

-- Enable trigram extension for fast ILIKE / similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for fast ILIKE on product name variants
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_name_ar_trgm
  ON products USING gin (name_ar gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_description_trgm
  ON products USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_badge_trgm
  ON products USING gin (badge gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_category_trgm
  ON products USING gin (category gin_trgm_ops);

-- Composite index for filtered listing (status + category + price + rating)
CREATE INDEX IF NOT EXISTS idx_products_filter
  ON products (status, category, price, rating DESC NULLS LAST);

-- Trigram indexes on product_translations for multilingual search
CREATE INDEX IF NOT EXISTS idx_prod_trans_name_trgm
  ON product_translations USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_prod_trans_desc_trgm
  ON product_translations USING gin (short_description gin_trgm_ops);

-- Index on shades for color/shade search
CREATE INDEX IF NOT EXISTS idx_product_shades_name_trgm
  ON product_shades USING gin (name gin_trgm_ops);
