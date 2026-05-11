/*
  # Add full-text search indexes for product AI recommendations

  ## Purpose
  The Beauty AI Chat needs to search products across name, description, purpose,
  category, and makeup_subcategory fields efficiently. This migration adds:
  
  1. A GIN full-text search index on (name || description || purpose)
  2. A btree index on (category, status) for fast category+status filtering
  3. A btree index on (in_stock, status) for stock-aware filtering

  These indexes make the AI chat product queries fast even as the catalog grows.
*/

-- Full-text search index on name + description + purpose (coalesced to avoid null issues)
CREATE INDEX IF NOT EXISTS idx_products_fts
  ON public.products
  USING gin(
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(purpose, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(makeup_subcategory, '')
    )
  );

-- Fast category + status lookup
CREATE INDEX IF NOT EXISTS idx_products_category_status
  ON public.products (category, status);

-- Stock-aware filtering
CREATE INDEX IF NOT EXISTS idx_products_instock_status
  ON public.products (in_stock, status);
