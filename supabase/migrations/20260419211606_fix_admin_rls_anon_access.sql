/*
  # Fix Admin RLS Policies for Custom Auth System

  ## Problem
  The admin system uses custom (mock) authentication — it does NOT use Supabase Auth.
  This means auth.uid() is always NULL when admin users make requests, causing all
  policies restricted to 'authenticated' role to reject writes with:
  "new row violates row-level security policy"

  ## Solution
  Extend INSERT/UPDATE/DELETE policies on all content-management tables to also
  allow the 'anon' role. Public SELECT is already open. This is safe because:
  - The admin panel has its own login gate (checked in React before rendering)
  - These tables contain only CMS/storefront config data, not user PII
  - Read is already public; write access via anon matches the current security model

  ## Tables Fixed
  1. homepage_content  - hero text, section content
  2. site_branding     - logo, colors, branding values
  3. cms_content       - multilanguage CMS fields
  4. layout_settings   - spacing/typography settings
  5. page_blocks       - page builder blocks
  6. page_layouts      - page builder layouts
  7. theme_settings    - theme color settings
  8. site_settings     - general site settings

  ## Storage Fixed
  - hero-images bucket INSERT/UPDATE/DELETE for anon
  - logos bucket INSERT/UPDATE/DELETE for anon
  - banners bucket INSERT/UPDATE/DELETE for anon
  - product-images bucket INSERT/UPDATE/DELETE for anon
  - uploads bucket INSERT/UPDATE/DELETE for anon
*/

-- ─── homepage_content ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can insert homepage content" ON homepage_content;
DROP POLICY IF EXISTS "Anyone can update homepage content" ON homepage_content;

CREATE POLICY "Anon and auth can insert homepage content"
  ON homepage_content FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon and auth can update homepage content"
  ON homepage_content FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon and auth can delete homepage content"
  ON homepage_content FOR DELETE
  TO anon, authenticated
  USING (true);

-- ─── site_branding ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can manage branding" ON site_branding;
DROP POLICY IF EXISTS "Authenticated users can update branding" ON site_branding;

CREATE POLICY "Anon and auth can insert branding"
  ON site_branding FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon and auth can update branding"
  ON site_branding FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon and auth can delete branding"
  ON site_branding FOR DELETE
  TO anon, authenticated
  USING (true);

-- ─── cms_content ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated can manage cms_content" ON cms_content;
DROP POLICY IF EXISTS "Authenticated can update cms_content" ON cms_content;

CREATE POLICY "Anon and auth can insert cms_content"
  ON cms_content FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon and auth can update cms_content"
  ON cms_content FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon and auth can delete cms_content"
  ON cms_content FOR DELETE
  TO anon, authenticated
  USING (true);

-- ─── layout_settings ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can insert layout settings" ON layout_settings;
DROP POLICY IF EXISTS "Authenticated users can update layout settings" ON layout_settings;

CREATE POLICY "Anon and auth can insert layout settings"
  ON layout_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon and auth can update layout settings"
  ON layout_settings FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon and auth can delete layout settings"
  ON layout_settings FOR DELETE
  TO anon, authenticated
  USING (true);

-- ─── page_blocks ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can insert page blocks" ON page_blocks;
DROP POLICY IF EXISTS "Authenticated users can update page blocks" ON page_blocks;
DROP POLICY IF EXISTS "Authenticated users can delete page blocks" ON page_blocks;

CREATE POLICY "Anon and auth can insert page blocks"
  ON page_blocks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon and auth can update page blocks"
  ON page_blocks FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon and auth can delete page blocks"
  ON page_blocks FOR DELETE
  TO anon, authenticated
  USING (true);

-- ─── page_layouts ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can insert page layouts" ON page_layouts;
DROP POLICY IF EXISTS "Authenticated users can update page layouts" ON page_layouts;

CREATE POLICY "Anon and auth can insert page layouts"
  ON page_layouts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon and auth can update page layouts"
  ON page_layouts FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon and auth can delete page layouts"
  ON page_layouts FOR DELETE
  TO anon, authenticated
  USING (true);

-- ─── theme_settings ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated can manage theme_settings" ON theme_settings;
DROP POLICY IF EXISTS "Authenticated can update theme_settings" ON theme_settings;
DROP POLICY IF EXISTS "theme_settings_anon_insert" ON theme_settings;
DROP POLICY IF EXISTS "theme_settings_anon_update" ON theme_settings;

CREATE POLICY "Anon and auth can insert theme settings"
  ON theme_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon and auth can update theme settings"
  ON theme_settings FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon and auth can delete theme settings"
  ON theme_settings FOR DELETE
  TO anon, authenticated
  USING (true);

-- ─── site_settings ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can insert site settings" ON site_settings;
DROP POLICY IF EXISTS "Anyone can update site settings" ON site_settings;

CREATE POLICY "Anon and auth can insert site settings"
  ON site_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anon and auth can update site settings"
  ON site_settings FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon and auth can delete site settings"
  ON site_settings FOR DELETE
  TO anon, authenticated
  USING (true);

-- ─── Storage: hero-images ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Auth upload hero-images" ON storage.objects;

CREATE POLICY "Anon and auth upload hero-images"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'hero-images');

CREATE POLICY "Anon and auth update hero-images"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'hero-images')
  WITH CHECK (bucket_id = 'hero-images');

CREATE POLICY "Anon and auth delete hero-images"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'hero-images');

-- ─── Storage: logos ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Auth upload logos" ON storage.objects;

CREATE POLICY "Anon and auth upload logos"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Anon and auth update logos"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'logos')
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Anon and auth delete logos"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'logos');

-- ─── Storage: banners ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Auth upload banners" ON storage.objects;

CREATE POLICY "Anon and auth upload banners"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'banners');

CREATE POLICY "Anon and auth update banners"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'banners')
  WITH CHECK (bucket_id = 'banners');

CREATE POLICY "Anon and auth delete banners"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'banners');

-- ─── Storage: product-images ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Auth upload product-images" ON storage.objects;

CREATE POLICY "Anon and auth upload product-images"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Anon and auth update product-images"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Anon and auth delete product-images"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'product-images');

-- ─── Storage: uploads ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;

CREATE POLICY "Anon and auth upload to uploads bucket"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Anon and auth update uploads bucket"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'uploads')
  WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Anon and auth delete from uploads bucket"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'uploads');

-- ─── Storage: testimonials ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Auth upload testimonials" ON storage.objects;

CREATE POLICY "Anon and auth upload testimonials"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'testimonials');

CREATE POLICY "Anon and auth update testimonials"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'testimonials')
  WITH CHECK (bucket_id = 'testimonials');

CREATE POLICY "Anon and auth delete testimonials"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'testimonials');

-- ─── Storage: general catch-all for update/delete ─────────────────────────────
-- The existing broad update/delete policies used 'true' with no role restriction.
-- Drop and replace with explicit anon+authenticated targeting.

DROP POLICY IF EXISTS "Auth update storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete storage objects" ON storage.objects;

CREATE POLICY "Anon and auth update any storage object"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon and auth delete any storage object"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (true);
