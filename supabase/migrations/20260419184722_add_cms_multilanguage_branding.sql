/*
  # CMS: Multi-language Content + Branding

  ## Summary
  Extends the CMS to support per-language content rows and adds a branding/logo
  configuration table so the admin can manage the app name, logo URL, and header
  appearance from the admin dashboard without touching code.

  ## Changes

  ### Modified Tables
  - `homepage_content`
    - `language` (text, default 'en') — ISO language code so each content row can
      be scoped to a specific language (en, ar, es, de).

  ### New Tables
  - `site_branding`
    - `id` (uuid, primary key)
    - `key` (text, unique) — e.g. "logo_url", "app_name", "header_tagline"
    - `value` (text) — the setting value
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled on `site_branding`
  - SELECT open to all (anon + authenticated) so the storefront can read it
  - INSERT / UPDATE / DELETE restricted to authenticated users only
    (admin panel uses the service-role key via the anon key in an authenticated session)
  - `homepage_content` existing policies are preserved; a SELECT policy is added for
    anon reads if not already present.

  ## Notes
  1. The `language` column is added with a safe IF-NOT-EXISTS guard.
  2. Default seed rows for English are inserted into site_branding so the header
     renders immediately without requiring an admin to set values first.
  3. Default seed rows for all four languages are inserted into homepage_content
     for the hero, featured, canopy, testimonials, and footer sections.
*/

-- 1. Add language column to homepage_content (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'homepage_content' AND column_name = 'language'
  ) THEN
    ALTER TABLE homepage_content ADD COLUMN language text NOT NULL DEFAULT 'en';
  END IF;
END $$;

-- Re-create the unique constraint to include language (drop old one first if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'homepage_content'
      AND constraint_name = 'homepage_content_section_key_key'
  ) THEN
    ALTER TABLE homepage_content DROP CONSTRAINT homepage_content_section_key_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'homepage_content'
      AND constraint_name = 'homepage_content_section_key_lang_key'
  ) THEN
    ALTER TABLE homepage_content
      ADD CONSTRAINT homepage_content_section_key_lang_key
      UNIQUE (section, key, language);
  END IF;
END $$;

-- Ensure anon can read homepage_content
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'homepage_content' AND policyname = 'Public can read homepage content'
  ) THEN
    CREATE POLICY "Public can read homepage content"
      ON homepage_content FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- 2. Create site_branding table
CREATE TABLE IF NOT EXISTS site_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_branding ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'site_branding' AND policyname = 'Public can read branding'
  ) THEN
    CREATE POLICY "Public can read branding"
      ON site_branding FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'site_branding' AND policyname = 'Authenticated users can manage branding'
  ) THEN
    CREATE POLICY "Authenticated users can manage branding"
      ON site_branding FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'site_branding' AND policyname = 'Authenticated users can update branding'
  ) THEN
    CREATE POLICY "Authenticated users can update branding"
      ON site_branding FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 3. Seed default branding values
INSERT INTO site_branding (key, value) VALUES
  ('logo_url',      ''),
  ('app_name',      'SKYDIVER'),
  ('app_tagline',   'MAN GEAR'),
  ('header_icons',  'true')
ON CONFLICT (key) DO NOTHING;

-- 4. Seed default English homepage content
INSERT INTO homepage_content (section, key, value, language) VALUES
  ('hero', 'image_url',    'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=800', 'en'),
  ('hero', 'badge_text',   'PROFESSIONAL GRADE', 'en'),
  ('hero', 'title',        'Tested in Real Skydives', 'en'),
  ('hero', 'subtitle',     'Gear trusted by 10,000+ skydivers worldwide', 'en'),
  ('hero', 'cta_primary',  'Shop Now', 'en'),
  ('hero', 'cta_secondary','View Featured', 'en'),
  ('featured', 'title',    'Featured Gear', 'en'),
  ('featured', 'subtitle', 'Hand-picked by our experts', 'en'),
  ('featured', 'enabled',  'true', 'en'),
  ('canopy', 'title',      'Find Your Canopy', 'en'),
  ('canopy', 'subtitle',   'Use our expert tool to find the right canopy for your experience level.', 'en'),
  ('canopy', 'cta_text',   'Use Canopy Advisor', 'en'),
  ('canopy', 'enabled',    'true', 'en'),
  ('testimonials', 'title',   'Trusted by Skydivers', 'en'),
  ('testimonials', 'subtitle','Hear from our community', 'en'),
  ('testimonials', 'enabled', 'true', 'en'),
  ('footer', 'tagline',    'Professional skydiving equipment trusted worldwide.', 'en'),
  ('footer', 'copyright',  '© 2026 Skydiver Man Gear. All rights reserved.', 'en'),
  ('footer', 'logo_url',   '', 'en'),
  ('footer', 'col1_title', 'Shop', 'en'),
  ('footer', 'col2_title', 'Company', 'en'),
  ('footer', 'col3_title', 'Support', 'en')
ON CONFLICT (section, key, language) DO NOTHING;

-- Arabic defaults
INSERT INTO homepage_content (section, key, value, language) VALUES
  ('hero', 'image_url',    'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=800', 'ar'),
  ('hero', 'badge_text',   'درجة احترافية', 'ar'),
  ('hero', 'title',        'اختبر في قفزات حقيقية', 'ar'),
  ('hero', 'subtitle',     'معدات موثوقة من قِبل أكثر من 10,000 قافز في العالم', 'ar'),
  ('hero', 'cta_primary',  'تسوق الآن', 'ar'),
  ('hero', 'cta_secondary','عرض المميز', 'ar'),
  ('featured', 'title',    'المعدات المميزة', 'ar'),
  ('featured', 'subtitle', 'اختيار يدوي من خبرائنا', 'ar'),
  ('featured', 'enabled',  'true', 'ar'),
  ('canopy', 'title',      'اعثر على مظلتك', 'ar'),
  ('canopy', 'subtitle',   'استخدم أداتنا المتخصصة للعثور على المظلة المناسبة لمستواك.', 'ar'),
  ('canopy', 'cta_text',   'استخدم مستشار المظلة', 'ar'),
  ('canopy', 'enabled',    'true', 'ar'),
  ('testimonials', 'title',   'موثوق من قِبل القافزين', 'ar'),
  ('testimonials', 'subtitle','اسمع من مجتمعنا', 'ar'),
  ('testimonials', 'enabled', 'true', 'ar'),
  ('footer', 'tagline',    'معدات القفز المهني الموثوقة في جميع أنحاء العالم.', 'ar'),
  ('footer', 'copyright',  '© 2026 Skydiver Man Gear. جميع الحقوق محفوظة.', 'ar'),
  ('footer', 'logo_url',   '', 'ar'),
  ('footer', 'col1_title', 'تسوق', 'ar'),
  ('footer', 'col2_title', 'الشركة', 'ar'),
  ('footer', 'col3_title', 'الدعم', 'ar')
ON CONFLICT (section, key, language) DO NOTHING;

-- Spanish defaults
INSERT INTO homepage_content (section, key, value, language) VALUES
  ('hero', 'image_url',    'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=800', 'es'),
  ('hero', 'badge_text',   'GRADO PROFESIONAL', 'es'),
  ('hero', 'title',        'Probado en saltos reales', 'es'),
  ('hero', 'subtitle',     'Equipo de confianza de más de 10,000 paracaidistas en todo el mundo', 'es'),
  ('hero', 'cta_primary',  'Comprar ahora', 'es'),
  ('hero', 'cta_secondary','Ver destacados', 'es'),
  ('featured', 'title',    'Equipo destacado', 'es'),
  ('featured', 'subtitle', 'Seleccionado a mano por nuestros expertos', 'es'),
  ('featured', 'enabled',  'true', 'es'),
  ('canopy', 'title',      'Encuentra tu paracaídas', 'es'),
  ('canopy', 'subtitle',   'Usa nuestra herramienta experta para encontrar el paracaídas adecuado para tu nivel.', 'es'),
  ('canopy', 'cta_text',   'Usar el asesor de paracaídas', 'es'),
  ('canopy', 'enabled',    'true', 'es'),
  ('testimonials', 'title',   'De confianza entre paracaidistas', 'es'),
  ('testimonials', 'subtitle','Escucha a nuestra comunidad', 'es'),
  ('testimonials', 'enabled', 'true', 'es'),
  ('footer', 'tagline',    'Equipo de paracaidismo profesional de confianza mundial.', 'es'),
  ('footer', 'copyright',  '© 2026 Skydiver Man Gear. Todos los derechos reservados.', 'es'),
  ('footer', 'logo_url',   '', 'es'),
  ('footer', 'col1_title', 'Tienda', 'es'),
  ('footer', 'col2_title', 'Empresa', 'es'),
  ('footer', 'col3_title', 'Soporte', 'es')
ON CONFLICT (section, key, language) DO NOTHING;

-- German defaults
INSERT INTO homepage_content (section, key, value, language) VALUES
  ('hero', 'image_url',    'https://images.pexels.com/photos/1271375/pexels-photo-1271375.jpeg?auto=compress&cs=tinysrgb&w=800', 'de'),
  ('hero', 'badge_text',   'PROFESSIONELLE QUALITÄT', 'de'),
  ('hero', 'title',        'Getestet bei echten Sprüngen', 'de'),
  ('hero', 'subtitle',     'Ausrüstung, der über 10.000 Fallschirmspringer weltweit vertrauen', 'de'),
  ('hero', 'cta_primary',  'Jetzt kaufen', 'de'),
  ('hero', 'cta_secondary','Highlights anzeigen', 'de'),
  ('featured', 'title',    'Empfohlene Ausrüstung', 'de'),
  ('featured', 'subtitle', 'Handverlesen von unseren Experten', 'de'),
  ('featured', 'enabled',  'true', 'de'),
  ('canopy', 'title',      'Finde deinen Fallschirm', 'de'),
  ('canopy', 'subtitle',   'Nutze unser Expertenwerkzeug, um den richtigen Fallschirm für dein Niveau zu finden.', 'de'),
  ('canopy', 'cta_text',   'Fallschirmberater nutzen', 'de'),
  ('canopy', 'enabled',    'true', 'de'),
  ('testimonials', 'title',   'Von Fallschirmspringern vertraut', 'de'),
  ('testimonials', 'subtitle','Höre von unserer Community', 'de'),
  ('testimonials', 'enabled', 'true', 'de'),
  ('footer', 'tagline',    'Professionelle Fallschirmausrüstung, der weltweit vertraut wird.', 'de'),
  ('footer', 'copyright',  '© 2026 Skydiver Man Gear. Alle Rechte vorbehalten.', 'de'),
  ('footer', 'logo_url',   '', 'de'),
  ('footer', 'col1_title', 'Shop', 'de'),
  ('footer', 'col2_title', 'Unternehmen', 'de'),
  ('footer', 'col3_title', 'Support', 'de')
ON CONFLICT (section, key, language) DO NOTHING;
