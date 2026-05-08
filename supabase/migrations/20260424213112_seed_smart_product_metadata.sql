/*
  # Seed Smart Product Metadata

  Populates the ingredients, concerns, skin_types, purpose, and suitable_undertone
  columns for all active products so the AI can do real ingredient/concern-based
  matching when recommending products.

  Products updated:
  - Velvet Matte Lipstick       → lip color, all undertones, hydrating
  - Lazurde Lipstick            → lip color, warm undertone focus
  - Luxe Eyeshadow Palette      → eye makeup, all undertones
  - Dramatic Volume Mascara     → lash, all types

  Also fixes the category values so they match the CATEGORY_KEYWORDS used
  by the edge function (e.g. "makeup" → "lipstick"/"mascara").
*/

-- Velvet Matte Lipstick
UPDATE products SET
  ingredients      = ARRAY['vitamin e', 'shea butter', 'jojoba oil', 'pigment'],
  concerns         = ARRAY['dry lips', 'pigmentation', 'dullness'],
  skin_types       = ARRAY['all'],
  purpose          = 'Long-lasting matte lip color with hydrating vitamin E formula',
  suitable_undertone = ARRAY['warm','cool','neutral'],
  category         = 'lipstick',
  is_featured      = true
WHERE id = 'b0000000-0000-0000-0000-000000000001';

-- Lazurde Lipstick (described as lightweight foundation — keeping as lipstick per name)
UPDATE products SET
  ingredients      = ARRAY['hyaluronic acid', 'vitamin e', 'pigment', 'beeswax'],
  concerns         = ARRAY['dry lips', 'uneven lip tone'],
  skin_types       = ARRAY['all'],
  purpose          = 'Hydrating lip color with hyaluronic acid for plump, smooth lips',
  suitable_undertone = ARRAY['warm','neutral'],
  category         = 'lipstick',
  is_featured      = true
WHERE id = 'b0000000-0000-0000-0000-000000000002';

-- Luxe Eyeshadow Palette
UPDATE products SET
  ingredients      = ARRAY['mica', 'talc', 'dimethicone', 'pigment', 'kaolin'],
  concerns         = ARRAY['dull eyes', 'hooded lids', 'uneven eyelid tone'],
  skin_types       = ARRAY['all'],
  purpose          = '12-shade palette for eye definition, dimension, and all-day wear',
  suitable_undertone = ARRAY['warm','cool','neutral'],
  category         = 'eyeshadow',
  is_featured      = true
WHERE id = 'b0000000-0000-0000-0000-000000000003';

-- Dramatic Volume Mascara
UPDATE products SET
  ingredients      = ARRAY['beeswax', 'carnauba wax', 'panthenol', 'vitamin b5', 'pigment'],
  concerns         = ARRAY['sparse lashes', 'short lashes', 'lash loss'],
  skin_types       = ARRAY['all'],
  purpose          = 'Volumizing mascara with panthenol to strengthen and lengthen lashes',
  suitable_undertone = ARRAY['warm','cool','neutral'],
  category         = 'mascara',
  is_featured      = true
WHERE id = 'b0000000-0000-0000-0000-000000000004';
