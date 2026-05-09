/*
  # Add performance indexes for product queries

  ## Purpose
  Speed up the most common storefront queries on the products table.
  All indexes use IF NOT EXISTS to be safe on re-run.

  ## New Indexes

  ### products table
  - idx_products_status          — fast filter on status='active'
  - idx_products_status_created  — composite for active + ORDER BY created_at DESC (main list query)
  - idx_products_category_status — composite for category filter + status
  - idx_products_category_id     — for category_id joins/filters
  - idx_products_is_featured     — for featured product queries
  - idx_products_makeup_sub      — for makeup subcategory filter

  ### product_translations table
  - idx_product_translations_product_language — composite index for the left join pattern
    (product_id + language) — covers the `!left` join in fetchProducts

  ### homepage_section_products table
  - idx_hsp_section_id     — speeds up the .in('section_id', sectionIds) query
  - idx_hsp_product_id     — speeds up the product lookup pass

  ### categories table
  - idx_categories_active_sort — for the standard fetchCategories query
*/

-- products
CREATE INDEX IF NOT EXISTS idx_products_status
  ON products (status);

CREATE INDEX IF NOT EXISTS idx_products_status_created
  ON products (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_category_status
  ON products (category, status);

CREATE INDEX IF NOT EXISTS idx_products_category_id
  ON products (category_id);

CREATE INDEX IF NOT EXISTS idx_products_is_featured
  ON products (is_featured)
  WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_products_makeup_sub
  ON products (makeup_subcategory)
  WHERE makeup_subcategory IS NOT NULL;

-- product_translations (speeds up the !left join)
CREATE INDEX IF NOT EXISTS idx_product_translations_product_language
  ON product_translations (product_id, language);

-- homepage_section_products
CREATE INDEX IF NOT EXISTS idx_hsp_section_id
  ON homepage_section_products (section_id);

CREATE INDEX IF NOT EXISTS idx_hsp_product_id
  ON homepage_section_products (product_id);

-- categories
CREATE INDEX IF NOT EXISTS idx_categories_active_sort
  ON categories (active, sort_order)
  WHERE active = true;
