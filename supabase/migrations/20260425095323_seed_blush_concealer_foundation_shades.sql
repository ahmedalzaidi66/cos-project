/*
  # Seed shades for blush, concealer, and foundation products

  ## Summary
  Adds realistic shade variants to all blush, concealer, and foundation products
  so the Virtual Try-On button becomes eligible (requires at least one shade).
  Also sets try_on_type on each product to guarantee correct tab routing.

  ## Changes
  - product_shades: inserts shades for 2 blush, 2 concealer, and 3 foundation products
  - products: sets try_on_type = 'blush' / 'concealer' / 'foundation' on each

  ## Shades added
  - Velvet Rose Blush: 5 shades (peach → berry)
  - Berry Glow Blush: 5 shades (coral → deep plum)
  - Full Coverage Concealer: 6 shades (porcelain → deep)
  - Brightening Eye Concealer: 6 shades (porcelain → deep)
  - Luminous Satin Foundation – Fair: 4 shades (porcelain/ivory range)
  - Luminous Satin Foundation – Medium: 4 shades (sand/caramel range)
  - Luminous Satin Foundation – Tan: 4 shades (warm tan → espresso)
*/

-- ── Set try_on_type ──────────────────────────────────────────────────────────

UPDATE products SET try_on_type = 'blush'
WHERE id IN (
  'c0000008-0000-0000-0000-000000000001',
  'c0000008-0000-0000-0000-000000000002'
);

UPDATE products SET try_on_type = 'concealer'
WHERE id IN (
  'c0000007-0000-0000-0000-000000000001',
  'c0000007-0000-0000-0000-000000000002'
);

UPDATE products SET try_on_type = 'foundation'
WHERE id IN (
  'c0000006-0000-0000-0000-000000000001',
  'c0000006-0000-0000-0000-000000000002',
  'c0000006-0000-0000-0000-000000000003'
);

-- ── Velvet Rose Blush shades ─────────────────────────────────────────────────

INSERT INTO product_shades (product_id, name, color_hex, shade_image, product_image, sort_order)
VALUES
  ('c0000008-0000-0000-0000-000000000001', 'Peach Petal',  '#F4A28C', '', '', 0),
  ('c0000008-0000-0000-0000-000000000001', 'Rose Glow',    '#E07B8B', '', '', 1),
  ('c0000008-0000-0000-0000-000000000001', 'Velvet Rose',  '#D4607A', '', '', 2),
  ('c0000008-0000-0000-0000-000000000001', 'Berry Flush',  '#C06080', '', '', 3),
  ('c0000008-0000-0000-0000-000000000001', 'Warm Coral',   '#E8916A', '', '', 4)
ON CONFLICT DO NOTHING;

-- ── Berry Glow Blush shades ──────────────────────────────────────────────────

INSERT INTO product_shades (product_id, name, color_hex, shade_image, product_image, sort_order)
VALUES
  ('c0000008-0000-0000-0000-000000000002', 'Coral Crush',  '#E8916A', '', '', 0),
  ('c0000008-0000-0000-0000-000000000002', 'Berry Glow',   '#C05A7A', '', '', 1),
  ('c0000008-0000-0000-0000-000000000002', 'Plum Blush',   '#9E4A6E', '', '', 2),
  ('c0000008-0000-0000-0000-000000000002', 'Bronze Sun',   '#C48860', '', '', 3),
  ('c0000008-0000-0000-0000-000000000002', 'Deep Mauve',   '#8B4A6B', '', '', 4)
ON CONFLICT DO NOTHING;

-- ── Full Coverage Concealer shades ────────────────────────────────────────────

INSERT INTO product_shades (product_id, name, color_hex, shade_image, product_image, sort_order)
VALUES
  ('c0000007-0000-0000-0000-000000000001', 'Porcelain',    '#F5DCC8', '', '', 0),
  ('c0000007-0000-0000-0000-000000000001', 'Ivory',        '#EFD0B0', '', '', 1),
  ('c0000007-0000-0000-0000-000000000001', 'Light Beige',  '#E8C9A8', '', '', 2),
  ('c0000007-0000-0000-0000-000000000001', 'Medium Sand',  '#D4A574', '', '', 3),
  ('c0000007-0000-0000-0000-000000000001', 'Warm Tan',     '#C4956A', '', '', 4),
  ('c0000007-0000-0000-0000-000000000001', 'Deep Mocha',   '#8B6B4A', '', '', 5)
ON CONFLICT DO NOTHING;

-- ── Brightening Eye Concealer shades ─────────────────────────────────────────

INSERT INTO product_shades (product_id, name, color_hex, shade_image, product_image, sort_order)
VALUES
  ('c0000007-0000-0000-0000-000000000002', 'Porcelain',    '#F5DCC8', '', '', 0),
  ('c0000007-0000-0000-0000-000000000002', 'Fair Ivory',   '#F0CEB0', '', '', 1),
  ('c0000007-0000-0000-0000-000000000002', 'Light Beige',  '#E5C49A', '', '', 2),
  ('c0000007-0000-0000-0000-000000000002', 'Medium Sand',  '#D2A070', '', '', 3),
  ('c0000007-0000-0000-0000-000000000002', 'Warm Tan',     '#C09060', '', '', 4),
  ('c0000007-0000-0000-0000-000000000002', 'Deep Mocha',   '#8A6040', '', '', 5)
ON CONFLICT DO NOTHING;

-- ── Luminous Satin Foundation – Fair shades ───────────────────────────────────

INSERT INTO product_shades (product_id, name, color_hex, shade_image, product_image, sort_order)
VALUES
  ('c0000006-0000-0000-0000-000000000001', 'Porcelain',    '#FADCC4', '', '', 0),
  ('c0000006-0000-0000-0000-000000000001', 'Ivory',        '#F0CEB0', '', '', 1),
  ('c0000006-0000-0000-0000-000000000001', 'Fair Beige',   '#E8C4A0', '', '', 2),
  ('c0000006-0000-0000-0000-000000000001', 'Natural',      '#DDB888', '', '', 3)
ON CONFLICT DO NOTHING;

-- ── Luminous Satin Foundation – Medium shades ────────────────────────────────

INSERT INTO product_shades (product_id, name, color_hex, shade_image, product_image, sort_order)
VALUES
  ('c0000006-0000-0000-0000-000000000002', 'Sand',         '#D4A878', '', '', 0),
  ('c0000006-0000-0000-0000-000000000002', 'Warm Sand',    '#C89C6A', '', '', 1),
  ('c0000006-0000-0000-0000-000000000002', 'Caramel',      '#BA8A5C', '', '', 2),
  ('c0000006-0000-0000-0000-000000000002', 'Golden Tan',   '#AA7A50', '', '', 3)
ON CONFLICT DO NOTHING;

-- ── Luminous Satin Foundation – Tan shades ───────────────────────────────────

INSERT INTO product_shades (product_id, name, color_hex, shade_image, product_image, sort_order)
VALUES
  ('c0000006-0000-0000-0000-000000000003', 'Warm Tan',     '#C4956A', '', '', 0),
  ('c0000006-0000-0000-0000-000000000003', 'Toffee',       '#A87850', '', '', 1),
  ('c0000006-0000-0000-0000-000000000003', 'Espresso',     '#7A5030', '', '', 2),
  ('c0000006-0000-0000-0000-000000000003', 'Deep Mocha',   '#6B4226', '', '', 3)
ON CONFLICT DO NOTHING;
