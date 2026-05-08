/*
  # Add shade/variant columns to order_items

  1. Modified Tables
    - `order_items`
      - `shade_name` (text, default '') - Name of the selected shade/color variant
      - `shade_hex` (text, default '') - Hex color code of the selected shade
      - `shade_image` (text, default '') - URL of the shade swatch image
      - `shade_product_image` (text, default '') - URL of the product image for this shade

  2. Important Notes
    - No existing data is modified or dropped
    - New columns have safe defaults so existing orders are unaffected
    - These columns allow order line items to record which shade was selected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'shade_name'
  ) THEN
    ALTER TABLE order_items ADD COLUMN shade_name text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'shade_hex'
  ) THEN
    ALTER TABLE order_items ADD COLUMN shade_hex text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'shade_image'
  ) THEN
    ALTER TABLE order_items ADD COLUMN shade_image text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'shade_product_image'
  ) THEN
    ALTER TABLE order_items ADD COLUMN shade_product_image text DEFAULT '';
  END IF;
END $$;
