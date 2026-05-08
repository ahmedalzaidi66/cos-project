/*
  # Fix homepage content: Replace old Skydiver data with Lazurde Makeup

  1. Changes
    - Update page_blocks hero content to match admin-saved homepage_content (Lazurde)
    - Update page_blocks featured, testimonials, footer content to Lazurde Makeup
    - Update homepage_content: fix old Skydiver references in non-English languages
    - Update homepage_content canopy section to skincare/beauty content
    - Update footer copyright in all languages to Lazurde Makeup

  2. Important Notes
    - No tables or columns are dropped
    - Only updating content values, not structure
    - Preserves admin-customized English hero title/subtitle from homepage_content
*/

-- 1. Update page_blocks hero to use the admin-saved content from homepage_content
UPDATE page_blocks
SET content = jsonb_build_object(
  'title', 'tested by lazurde fans',
  'subtitle', 'lazurde',
  'image_url', 'https://phrcospayhtsplxljsgu.supabase.co/storage/v1/object/public/uploads/cms/1776973528198-64jzt9vvz9.jpg',
  'badge_text', 'PREMIUM MAKEUP',
  'cta_primary', 'Shop Now',
  'cta_secondary', 'View Featured',
  'media_type', 'image',
  'video_url', '',
  'overlay_color', 'rgba(5,10,20,0.55)'
)
WHERE type = 'hero';

-- 2. Update page_blocks featured to Lazurde content
UPDATE page_blocks
SET content = jsonb_build_object(
  'title', 'AMAZING MAKEUP',
  'subtitle', 'BEAUTY GIRLS',
  'max_products', 6,
  'layout', 'grid'
)
WHERE type = 'featured';

-- 3. Update page_blocks testimonials
UPDATE page_blocks
SET content = jsonb_build_object(
  'title', 'LAZURDE',
  'subtitle', 'MAKEUP',
  'max_items', 6
)
WHERE type = 'testimonials';

-- 4. Update page_blocks footer
UPDATE page_blocks
SET content = jsonb_build_object(
  'tagline', 'Premium makeup for every skin tone.',
  'copyright', '© 2026 Lazurde Makeup. All rights reserved.',
  'col1_title', 'Shop',
  'col2_title', 'Company',
  'col3_title', 'Support',
  'contact_email', 'support@lazurdemakeup.com',
  'contact_phone', '+1 (800) 555-0199'
)
WHERE type = 'footer';

-- 5. Update page_blocks canopy to skincare
UPDATE page_blocks
SET content = jsonb_build_object(
  'title', 'Skincare',
  'subtitle', 'Our premium skincare collection is coming soon.',
  'cta_text', 'Coming Soon',
  'bg_color', ''
)
WHERE type = 'canopy';

-- 6. Fix homepage_content canopy section (old skydiving references)
UPDATE homepage_content
SET value = 'Skincare'
WHERE section = 'canopy' AND key = 'title' AND language = 'en';

UPDATE homepage_content
SET value = 'Our premium skincare collection is coming soon.'
WHERE section = 'canopy' AND key = 'subtitle' AND language = 'en';

UPDATE homepage_content
SET value = 'Coming Soon'
WHERE section = 'canopy' AND key = 'cta_text' AND language = 'en';

-- Arabic canopy
UPDATE homepage_content
SET value = 'العناية بالبشرة'
WHERE section = 'canopy' AND key = 'title' AND language = 'ar';

UPDATE homepage_content
SET value = 'مجموعتنا المميزة للعناية بالبشرة قادمة قريباً.'
WHERE section = 'canopy' AND key = 'subtitle' AND language = 'ar';

UPDATE homepage_content
SET value = 'قريباً'
WHERE section = 'canopy' AND key = 'cta_text' AND language = 'ar';

-- German canopy
UPDATE homepage_content
SET value = 'Hautpflege'
WHERE section = 'canopy' AND key = 'title' AND language = 'de';

UPDATE homepage_content
SET value = 'Unsere Premium-Hautpflegekollektion kommt bald.'
WHERE section = 'canopy' AND key = 'subtitle' AND language = 'de';

UPDATE homepage_content
SET value = 'Demnächst'
WHERE section = 'canopy' AND key = 'cta_text' AND language = 'de';

-- Spanish canopy
UPDATE homepage_content
SET value = 'Cuidado de la Piel'
WHERE section = 'canopy' AND key = 'title' AND language = 'es';

UPDATE homepage_content
SET value = 'Nuestra colección premium de cuidado de la piel llegará pronto.'
WHERE section = 'canopy' AND key = 'subtitle' AND language = 'es';

UPDATE homepage_content
SET value = 'Próximamente'
WHERE section = 'canopy' AND key = 'cta_text' AND language = 'es';

-- 7. Fix footer copyright in non-English languages
UPDATE homepage_content
SET value = '© 2026 Lazurde Makeup. جميع الحقوق محفوظة.'
WHERE section = 'footer' AND key = 'copyright' AND language = 'ar';

UPDATE homepage_content
SET value = '© 2026 Lazurde Makeup. Alle Rechte vorbehalten.'
WHERE section = 'footer' AND key = 'copyright' AND language = 'de';

UPDATE homepage_content
SET value = '© 2026 Lazurde Makeup. Todos los derechos reservados.'
WHERE section = 'footer' AND key = 'copyright' AND language = 'es';

-- 8. Fix footer tagline in non-English languages (old skydiving references)
UPDATE homepage_content
SET value = 'مكياج فاخر لكل لون بشرة.'
WHERE section = 'footer' AND key = 'tagline' AND language = 'ar';

UPDATE homepage_content
SET value = 'Premium-Make-up für jeden Hautton.'
WHERE section = 'footer' AND key = 'tagline' AND language = 'de';

UPDATE homepage_content
SET value = 'Maquillaje premium para cada tono de piel.'
WHERE section = 'footer' AND key = 'tagline' AND language = 'es';

-- 9. Fix testimonials in non-English languages (old skydiving references)
UPDATE homepage_content
SET value = 'لازوردي'
WHERE section = 'testimonials' AND key = 'title' AND language = 'ar';

UPDATE homepage_content
SET value = 'Lazurde'
WHERE section = 'testimonials' AND key = 'title' AND language = 'de';

UPDATE homepage_content
SET value = 'Lazurde'
WHERE section = 'testimonials' AND key = 'title' AND language = 'es';

UPDATE homepage_content
SET value = 'مكياج'
WHERE section = 'testimonials' AND key = 'subtitle' AND language = 'ar';

UPDATE homepage_content
SET value = 'Make-up'
WHERE section = 'testimonials' AND key = 'subtitle' AND language = 'de';

UPDATE homepage_content
SET value = 'Maquillaje'
WHERE section = 'testimonials' AND key = 'subtitle' AND language = 'es';

-- 10. Fix featured section in non-English languages  
UPDATE homepage_content
SET value = 'مكياج مذهل'
WHERE section = 'featured' AND key = 'title' AND language = 'ar';

UPDATE homepage_content
SET value = 'Erstaunliches Make-up'
WHERE section = 'featured' AND key = 'title' AND language = 'de';

UPDATE homepage_content
SET value = 'Maquillaje Increíble'
WHERE section = 'featured' AND key = 'title' AND language = 'es';

UPDATE homepage_content
SET value = 'فتيات الجمال'
WHERE section = 'featured' AND key = 'subtitle' AND language = 'ar';

UPDATE homepage_content
SET value = 'Beauty Girls'
WHERE section = 'featured' AND key = 'subtitle' AND language = 'de';

UPDATE homepage_content
SET value = 'Chicas de Belleza'
WHERE section = 'featured' AND key = 'subtitle' AND language = 'es';
