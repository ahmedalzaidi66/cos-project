/*
  # Seed Default Page Blocks

  ## Purpose
  The page_layouts table already has a "home" layout row but zero blocks,
  causing the Page Builder screen to render a blank editor.
  This migration inserts the default blocks (header, hero, featured, canopy,
  testimonials, banner, footer) linked to the existing "home" layout.

  ## Changes
  - Inserts 7 default page_blocks rows for the "home" layout if none exist.
  - Uses ON CONFLICT DO NOTHING to avoid duplicates on re-run.

  ## Notes
  - Does NOT drop or alter any existing data.
  - Safe to run multiple times.
*/

DO $$
DECLARE
  v_layout_id uuid;
BEGIN
  -- Get or create the home layout
  SELECT id INTO v_layout_id FROM page_layouts WHERE page = 'home' LIMIT 1;

  IF v_layout_id IS NULL THEN
    INSERT INTO page_layouts (page) VALUES ('home') RETURNING id INTO v_layout_id;
  END IF;

  -- Only seed blocks if the layout currently has zero blocks
  IF (SELECT COUNT(*) FROM page_blocks WHERE layout_id = v_layout_id) = 0 THEN
    INSERT INTO page_blocks (layout_id, type, order_index, visible, content) VALUES
      (v_layout_id, 'header',       0, true,  '{"show_cart":true,"show_account":true}'::jsonb),
      (v_layout_id, 'hero',         1, true,  '{"image_url":"https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=800","badge_text":"PROFESSIONAL GRADE","title":"Tested in Real Skydives","subtitle":"Gear trusted by 10,000+ skydivers worldwide","cta_primary":"Shop Now","cta_secondary":"View Featured","overlay_color":"rgba(5,10,20,0.55)"}'::jsonb),
      (v_layout_id, 'featured',     2, true,  '{"title":"Featured Gear","subtitle":"Hand-picked by our experts","max_products":6,"layout":"grid"}'::jsonb),
      (v_layout_id, 'canopy',       3, true,  '{"title":"Find Your Canopy","subtitle":"Use our expert tool to find the right canopy for your experience level.","cta_text":"Use Canopy Advisor","bg_color":""}'::jsonb),
      (v_layout_id, 'testimonials', 4, true,  '{"title":"Trusted by Skydivers","subtitle":"Hear from our community","max_items":6}'::jsonb),
      (v_layout_id, 'banner',       5, false, '{"text":"Free shipping on orders over $500","link_text":"Shop Now","link_url":"","bg_color":"#00BFFF","text_color":"#050A14"}'::jsonb),
      (v_layout_id, 'footer',       6, true,  '{"tagline":"Professional skydiving equipment trusted worldwide.","copyright":"© 2026 Skydiver Man Gear. All rights reserved.","col1_title":"Shop","col2_title":"Company","col3_title":"Support","contact_email":"support@skydivermagear.com","contact_phone":"+1 (800) 555-0199"}'::jsonb);
  END IF;
END $$;
