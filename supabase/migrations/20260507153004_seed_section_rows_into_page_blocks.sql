/*
  # Seed section_row entries into page_blocks

  ## Summary
  Previously, homepage_sections were tracked separately from page_blocks, so
  they could only be appended after static blocks and couldn't be interleaved.

  This migration inserts a section_row record into page_blocks for each active
  homepage_section that does not already have one. The order_index starts after
  the current maximum (6 = footer), so they appear at the end until the admin
  manually reorders them via Page Builder.

  ## Changes
  - Inserts page_blocks rows (type = 'section_row') for active homepage_sections
    that don't already have a corresponding page_block entry.
  - Uses content JSONB field to store section_id, title_en, title_ar, is_active.
  - Does not modify or delete existing page_blocks rows.
  - Does not modify homepage_sections rows.
*/

DO $$
DECLARE
  v_layout_id uuid;
  v_max_order integer;
  v_offset     integer := 0;
  v_sec        record;
BEGIN
  -- Get the home page layout id
  SELECT id INTO v_layout_id FROM page_layouts WHERE page = 'home' LIMIT 1;
  IF v_layout_id IS NULL THEN RETURN; END IF;

  -- Get current max order_index
  SELECT COALESCE(MAX(order_index), 6) INTO v_max_order FROM page_blocks WHERE layout_id = v_layout_id;

  -- Remove any stale section_row blocks whose section_id no longer exists
  DELETE FROM page_blocks
  WHERE layout_id = v_layout_id
    AND type = 'section_row'
    AND NOT EXISTS (
      SELECT 1 FROM homepage_sections hs
      WHERE hs.id::text = (page_blocks.content->>'section_id')
    );

  -- Insert section_row blocks for sections that don't have one yet
  FOR v_sec IN
    SELECT hs.id, hs.title_en, hs.title_ar, hs.is_active
    FROM homepage_sections hs
    WHERE NOT EXISTS (
      SELECT 1 FROM page_blocks pb
      WHERE pb.layout_id = v_layout_id
        AND pb.type = 'section_row'
        AND pb.content->>'section_id' = hs.id::text
    )
    ORDER BY hs.sort_order, hs.id
  LOOP
    INSERT INTO page_blocks (layout_id, type, order_index, visible, content, updated_at)
    VALUES (
      v_layout_id,
      'section_row',
      v_max_order + v_offset + 1,
      v_sec.is_active,
      jsonb_build_object(
        'section_id', v_sec.id::text,
        'title_en',   v_sec.title_en,
        'title_ar',   v_sec.title_ar,
        'is_active',  v_sec.is_active
      ),
      now()
    );
    v_offset := v_offset + 1;
  END LOOP;
END $$;
