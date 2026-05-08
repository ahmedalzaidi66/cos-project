/*
  # Seed Full Product Catalog for Routines

  Inserts a complete set of Lazurde Makeup products covering every routine step:

  Skincare:
  - 2 Cleansers
  - 2 Serums
  - 2 Moisturizers
  - 1 Sunscreen

  Makeup:
  - 2 Primers
  - 3 Foundations (light / medium / tan tones)
  - 2 Concealers
  - 2 Blushes
  - 1 Bronzer
  - 1 Highlighter
  - 1 Eyeliner
  - 1 Powder

  All existing products are preserved. New products get realistic
  ingredients, concerns, skin_types, purpose, suitable_undertone data
  so the routine engine can match them accurately.
*/

INSERT INTO products
  (id, name, category, price, description, purpose, ingredients, concerns, skin_types, suitable_undertone,
   rating, review_count, badge, status, is_featured, stock,
   image_url, main_image)
VALUES

-- ── SKINCARE ────────────────────────────────────────────────────────────────

-- Cleansers
(
  'c0000001-0000-0000-0000-000000000001',
  'Purifying Gel Cleanser',
  'cleanser', 38, 
  'Lightweight gel cleanser that removes impurities without stripping moisture. Ideal for oily and combination skin.',
  'Deep-cleanse pores, control shine, and balance sebum production with salicylic acid and niacinamide.',
  ARRAY['salicylic acid','niacinamide','green tea extract','glycerin'],
  ARRAY['oiliness','acne','clogged pores','shine'],
  ARRAY['oily','combination'],
  ARRAY['warm','cool','neutral'],
  4.7, 312, 'Best Seller', 'active', true, 200,
  'https://images.pexels.com/photos/3997373/pexels-photo-3997373.jpeg',
  'https://images.pexels.com/photos/3997373/pexels-photo-3997373.jpeg'
),
(
  'c0000001-0000-0000-0000-000000000002',
  'Hydrating Milk Cleanser',
  'cleanser', 42,
  'Creamy milk cleanser that gently dissolves makeup and soothes dry, sensitive skin while maintaining the skin barrier.',
  'Gently cleanse and hydrate dry or sensitive skin with ceramides and oat extract.',
  ARRAY['ceramide','oat extract','glycerin','allantoin','panthenol'],
  ARRAY['dryness','sensitivity','redness','flakiness'],
  ARRAY['dry','sensitive','normal'],
  ARRAY['warm','cool','neutral'],
  4.8, 278, 'Staff Pick', 'active', true, 180,
  'https://images.pexels.com/photos/4465124/pexels-photo-4465124.jpeg',
  'https://images.pexels.com/photos/4465124/pexels-photo-4465124.jpeg'
),

-- Serums
(
  'c0000002-0000-0000-0000-000000000001',
  'Niacinamide Pore Serum',
  'serum', 65,
  '10% niacinamide serum that minimizes pores, reduces oiliness, and evens skin tone. Clinically proven results in 4 weeks.',
  'Minimize pores, control oil, and even skin tone with high-dose niacinamide.',
  ARRAY['niacinamide','zinc pca','hyaluronic acid','panthenol'],
  ARRAY['oiliness','uneven tone','enlarged pores','acne','redness'],
  ARRAY['oily','combination','normal'],
  ARRAY['warm','cool','neutral'],
  4.9, 521, 'Top Rated', 'active', true, 150,
  'https://images.pexels.com/photos/5240677/pexels-photo-5240677.jpeg',
  'https://images.pexels.com/photos/5240677/pexels-photo-5240677.jpeg'
),
(
  'c0000002-0000-0000-0000-000000000002',
  'Vitamin C Brightening Serum',
  'serum', 75,
  'Stable 15% vitamin C serum with vitamin E and ferulic acid for maximum antioxidant protection and radiance.',
  'Brighten skin tone, fade dark spots, and boost collagen with stabilized vitamin C and ferulic acid.',
  ARRAY['vitamin c','vitamin e','ferulic acid','hyaluronic acid','niacinamide'],
  ARRAY['dark spots','uneven tone','dullness','hyperpigmentation','dark circles'],
  ARRAY['all','normal','dry','combination'],
  ARRAY['warm','cool','neutral'],
  4.8, 445, 'New', 'active', true, 130,
  'https://images.pexels.com/photos/6621461/pexels-photo-6621461.jpeg',
  'https://images.pexels.com/photos/6621461/pexels-photo-6621461.jpeg'
),

-- Moisturizers
(
  'c0000003-0000-0000-0000-000000000001',
  'Oil-Free Hydra Gel',
  'moisturizer', 55,
  'Lightweight oil-free gel moisturizer with hyaluronic acid that provides intense hydration without clogging pores.',
  'Provide deep hydration for oily skin without heaviness — hyaluronic acid locks in moisture, niacinamide controls shine.',
  ARRAY['hyaluronic acid','niacinamide','aloe vera','glycerin','centella asiatica'],
  ARRAY['oiliness','dehydration','acne','enlarged pores'],
  ARRAY['oily','combination'],
  ARRAY['warm','cool','neutral'],
  4.7, 388, 'Best Seller', 'active', true, 160,
  'https://images.pexels.com/photos/3685523/pexels-photo-3685523.jpeg',
  'https://images.pexels.com/photos/3685523/pexels-photo-3685523.jpeg'
),
(
  'c0000003-0000-0000-0000-000000000002',
  'Rich Barrier Cream',
  'moisturizer', 68,
  'Deeply nourishing cream that rebuilds the moisture barrier with ceramides and shea butter. Perfect for dry winter skin.',
  'Restore the skin barrier and lock in moisture all day with ceramides, shea butter, and squalane.',
  ARRAY['ceramide','shea butter','squalane','glycerin','vitamin e','allantoin'],
  ARRAY['dryness','sensitivity','redness','flakiness','barrier damage'],
  ARRAY['dry','very dry','sensitive'],
  ARRAY['warm','cool','neutral'],
  4.9, 302, 'Top Rated', 'active', true, 140,
  'https://images.pexels.com/photos/3762880/pexels-photo-3762880.jpeg',
  'https://images.pexels.com/photos/3762880/pexels-photo-3762880.jpeg'
),

-- Sunscreen
(
  'c0000004-0000-0000-0000-000000000001',
  'Invisible Shield SPF 50+',
  'sunscreen', 48,
  'Ultra-light SPF 50+ sunscreen that leaves zero white cast and doubles as a makeup primer. Water-resistant, non-greasy.',
  'Protect against UVA/UVB with SPF50+, prevent photoaging and dark spots — invisible on all skin tones.',
  ARRAY['zinc oxide','titanium dioxide','niacinamide','vitamin e','glycerin'],
  ARRAY['sun damage','photoaging','dark spots','hyperpigmentation','uneven tone'],
  ARRAY['all'],
  ARRAY['warm','cool','neutral'],
  4.8, 467, 'Best Seller', 'active', true, 220,
  'https://images.pexels.com/photos/6621472/pexels-photo-6621472.jpeg',
  'https://images.pexels.com/photos/6621472/pexels-photo-6621472.jpeg'
),

-- ── MAKEUP ──────────────────────────────────────────────────────────────────

-- Primers
(
  'c0000005-0000-0000-0000-000000000001',
  'Pore-Minimizing Primer',
  'primer', 45,
  'Silicone-free primer that blurs pores, controls oil, and extends makeup wear up to 16 hours.',
  'Smooth pores and control shine so foundation applies flawlessly and lasts all day.',
  ARRAY['niacinamide','dimethicone','silica','kaolin','aloe vera'],
  ARRAY['enlarged pores','oiliness','uneven texture','makeup longevity'],
  ARRAY['oily','combination'],
  ARRAY['warm','cool','neutral'],
  4.6, 234, NULL, 'active', false, 175,
  'https://images.pexels.com/photos/5797991/pexels-photo-5797991.jpeg',
  'https://images.pexels.com/photos/5797991/pexels-photo-5797991.jpeg'
),
(
  'c0000005-0000-0000-0000-000000000002',
  'Hydrating Glow Primer',
  'primer', 48,
  'Dewy primer with hyaluronic acid that plumps skin, adds radiance, and creates the perfect glowing base.',
  'Hydrate and illuminate dry skin before foundation for a luminous, skin-like finish.',
  ARRAY['hyaluronic acid','vitamin c','glycerin','pearl extract','squalane'],
  ARRAY['dryness','dullness','dehydration'],
  ARRAY['dry','normal'],
  ARRAY['warm','cool','neutral'],
  4.7, 198, NULL, 'active', false, 155,
  'https://images.pexels.com/photos/3735632/pexels-photo-3735632.jpeg',
  'https://images.pexels.com/photos/3735632/pexels-photo-3735632.jpeg'
),

-- Foundations
(
  'c0000006-0000-0000-0000-000000000001',
  'Luminous Satin Foundation – Fair',
  'foundation', 72,
  'Buildable medium-to-full coverage foundation in fair shades with a natural satin finish. SPF 20 included.',
  'Even and luminous coverage for fair to light skin tones with hyaluronic acid for all-day hydration.',
  ARRAY['hyaluronic acid','vitamin e','spf 20','glycerin','niacinamide'],
  ARRAY['uneven tone','redness','dryness','dullness'],
  ARRAY['all'],
  ARRAY['cool','neutral'],
  4.7, 356, NULL, 'active', false, 120,
  'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg',
  'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg'
),
(
  'c0000006-0000-0000-0000-000000000002',
  'Luminous Satin Foundation – Medium',
  'foundation', 72,
  'Buildable medium-to-full coverage foundation in medium shades. Natural satin finish that lasts 14 hours.',
  'Smooth, luminous coverage for medium skin tones with vitamin E and light-diffusing pigments.',
  ARRAY['vitamin e','hyaluronic acid','spf 20','light-diffusing pigment','glycerin'],
  ARRAY['uneven tone','acne scars','redness','dullness'],
  ARRAY['all'],
  ARRAY['warm','neutral'],
  4.8, 412, 'Best Seller', 'active', true, 135,
  'https://images.pexels.com/photos/3373716/pexels-photo-3373716.jpeg',
  'https://images.pexels.com/photos/3373716/pexels-photo-3373716.jpeg'
),
(
  'c0000006-0000-0000-0000-000000000003',
  'Luminous Satin Foundation – Tan',
  'foundation', 72,
  'Rich, full-coverage foundation in tan to deep shades with warm undertones. Long-wear formula.',
  'Full coverage for tan to deep skin tones with warm undertone pigments that enhance natural radiance.',
  ARRAY['vitamin e','hyaluronic acid','warm pigment','glycerin','niacinamide'],
  ARRAY['uneven tone','hyperpigmentation','dullness','acne scars'],
  ARRAY['all'],
  ARRAY['warm'],
  4.9, 389, 'Top Rated', 'active', true, 110,
  'https://images.pexels.com/photos/3373715/pexels-photo-3373715.jpeg',
  'https://images.pexels.com/photos/3373715/pexels-photo-3373715.jpeg'
),

-- Concealers
(
  'c0000007-0000-0000-0000-000000000001',
  'Full Coverage Concealer',
  'concealer', 38,
  'Full coverage creamy concealer that hides dark circles, blemishes, and redness. Crease-proof for 12 hours.',
  'Conceal dark circles and blemishes with full coverage — vitamin K and caffeine reduce puffiness.',
  ARRAY['vitamin k','caffeine','hyaluronic acid','vitamin e','niacinamide'],
  ARRAY['dark circles','blemishes','redness','acne scars','puffiness'],
  ARRAY['all'],
  ARRAY['warm','cool','neutral'],
  4.7, 289, NULL, 'active', false, 190,
  'https://images.pexels.com/photos/3059608/pexels-photo-3059608.jpeg',
  'https://images.pexels.com/photos/3059608/pexels-photo-3059608.jpeg'
),
(
  'c0000007-0000-0000-0000-000000000002',
  'Brightening Eye Concealer',
  'concealer', 42,
  'Lightweight concealer specifically formulated for the delicate under-eye area. Brightens and hydrates.',
  'Brighten and hydrate the under-eye area — vitamin C and retinol fade dark circles over time.',
  ARRAY['vitamin c','retinol','peptide','caffeine','hyaluronic acid'],
  ARRAY['dark circles','puffiness','fine lines','dehydration'],
  ARRAY['all'],
  ARRAY['warm','cool','neutral'],
  4.8, 321, 'New', 'active', true, 165,
  'https://images.pexels.com/photos/5069291/pexels-photo-5069291.jpeg',
  'https://images.pexels.com/photos/5069291/pexels-photo-5069291.jpeg'
),

-- Blushes
(
  'c0000008-0000-0000-0000-000000000001',
  'Velvet Rose Blush',
  'blush', 35,
  'Finely-milled powder blush in a rosy nude tone. Buildable color that looks natural on medium to dark skin.',
  'Add a natural healthy flush that complements warm and neutral undertones beautifully.',
  ARRAY['mica','pigment','talc','vitamin e'],
  ARRAY['dull complexion','flat cheeks'],
  ARRAY['all'],
  ARRAY['warm','neutral'],
  4.6, 213, NULL, 'active', false, 200,
  'https://images.pexels.com/photos/2253833/pexels-photo-2253833.jpeg',
  'https://images.pexels.com/photos/2253833/pexels-photo-2253833.jpeg'
),
(
  'c0000008-0000-0000-0000-000000000002',
  'Berry Glow Blush',
  'blush', 35,
  'Cool-toned berry blush that gives fair to medium skin a vibrant natural flush. Smooth and blendable.',
  'Deliver a fresh berry-toned flush that enhances cool and neutral undertones naturally.',
  ARRAY['mica','pigment','talc','argan oil'],
  ARRAY['dull complexion','flat cheeks'],
  ARRAY['all'],
  ARRAY['cool','neutral'],
  4.7, 187, NULL, 'active', false, 195,
  'https://images.pexels.com/photos/2395249/pexels-photo-2395249.jpeg',
  'https://images.pexels.com/photos/2395249/pexels-photo-2395249.jpeg'
),

-- Bronzer
(
  'c0000009-0000-0000-0000-000000000001',
  'Sun-Kissed Bronzer',
  'bronzer', 42,
  'Natural-looking matte bronzer for face sculpting and adding warmth. Works on all skin tones.',
  'Sculpt and add warm sun-kissed dimension to the face — matte finish for natural contour.',
  ARRAY['mica','iron oxide','talc','vitamin e'],
  ARRAY['flat complexion','lack of definition'],
  ARRAY['all'],
  ARRAY['warm','neutral'],
  4.6, 156, NULL, 'active', false, 170,
  'https://images.pexels.com/photos/2533268/pexels-photo-2533268.jpeg',
  'https://images.pexels.com/photos/2533268/pexels-photo-2533268.jpeg'
),

-- Highlighter
(
  'c0000010-0000-0000-0000-000000000001',
  'Starlit Highlighter',
  'highlighter', 45,
  'Finely-milled luminous highlighter that gives a blinding glow without glitter. Perfect for high points.',
  'Illuminate cheekbones and brow bones with a radiant pearl glow — no chunky glitter.',
  ARRAY['mica','pearl powder','vitamin e','silica'],
  ARRAY['dullness','lack of glow'],
  ARRAY['all'],
  ARRAY['warm','cool','neutral'],
  4.8, 234, 'New', 'active', true, 145,
  'https://images.pexels.com/photos/3685538/pexels-photo-3685538.jpeg',
  'https://images.pexels.com/photos/3685538/pexels-photo-3685538.jpeg'
),

-- Eyeliner
(
  'c0000011-0000-0000-0000-000000000001',
  'Precision Liquid Eyeliner',
  'eyeliner', 28,
  'Ultra-fine tip liquid eyeliner with smudge-proof, waterproof formula. Lasts 24 hours without fading.',
  'Define eyes with a precise, waterproof line that lasts all day without smudging.',
  ARRAY['carbon black pigment','beeswax','vitamin e','panthenol'],
  ARRAY['undefined eyes','smudging'],
  ARRAY['all'],
  ARRAY['warm','cool','neutral'],
  4.7, 378, 'Best Seller', 'active', true, 250,
  'https://images.pexels.com/photos/2681751/pexels-photo-2681751.jpeg',
  'https://images.pexels.com/photos/2681751/pexels-photo-2681751.jpeg'
),

-- Setting Powder
(
  'c0000012-0000-0000-0000-000000000001',
  'Translucent Setting Powder',
  'powder', 38,
  'Ultra-fine translucent powder that sets makeup, controls shine, and blurs imperfections. Works on all shades.',
  'Set makeup and control shine for up to 8 hours — translucent formula works on every skin tone.',
  ARRAY['silica','rice starch','talc','kaolin'],
  ARRAY['oiliness','makeup longevity','shine','texture'],
  ARRAY['all'],
  ARRAY['warm','cool','neutral'],
  4.7, 298, NULL, 'active', false, 210,
  'https://images.pexels.com/photos/3762874/pexels-photo-3762874.jpeg',
  'https://images.pexels.com/photos/3762874/pexels-photo-3762874.jpeg'
)

ON CONFLICT (id) DO NOTHING;
