/*
  # Add categories block to homepage page_blocks

  Inserts a 'categories' block at order_index 1.5 (between hero at 1 and
  section_row at 2) so the block-driven render loop places Shop by Category
  after the hero banner. Uses a decimal-safe approach: shift all blocks with
  order_index >= 2 up by 1, then insert categories at order_index 2.

  1. Changes
     - Shifts existing order_index values: 2 → 3, 3 → 4, ... for the home layout
     - Inserts a new block of type 'categories' at order_index 2
*/

DO $$
DECLARE
  v_layout_id uuid;
BEGIN
  SELECT id INTO v_layout_id FROM page_layouts WHERE page = 'home' LIMIT 1;
  IF v_layout_id IS NULL THEN RETURN; END IF;

  -- Only insert if no categories block exists yet
  IF NOT EXISTS (
    SELECT 1 FROM page_blocks WHERE layout_id = v_layout_id AND type = 'categories'
  ) THEN
    -- Shift all blocks at order_index >= 2 up by 1
    UPDATE page_blocks
    SET order_index = order_index + 1
    WHERE layout_id = v_layout_id AND order_index >= 2;

    -- Insert categories block at order_index 2 (after hero at 1)
    INSERT INTO page_blocks (layout_id, type, order_index, visible, content, updated_at)
    VALUES (v_layout_id, 'categories', 2, true, '{}', now());
  END IF;
END $$;
