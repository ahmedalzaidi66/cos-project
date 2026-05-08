/*
  # Storage Buckets for Storefront Assets

  Creates public storage buckets for:
  - product-images: Product photos
  - logos: Brand logos
  - hero-images: Hero banner images
  - banners: Promotional banners
  - testimonials: Testimonial/reviewer photos

  All buckets are public (read without auth), max 10MB files.
  Authenticated users can upload/update/delete.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('product-images', 'product-images', true, 10485760, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']),
  ('logos',          'logos',          true, 10485760, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/svg+xml']),
  ('hero-images',    'hero-images',    true, 10485760, ARRAY['image/jpeg','image/jpg','image/png','image/webp']),
  ('banners',        'banners',        true, 10485760, ARRAY['image/jpeg','image/jpg','image/png','image/webp']),
  ('testimonials',   'testimonials',   true, 10485760, ARRAY['image/jpeg','image/jpg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Public read policies
CREATE POLICY "Public read product-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Public read logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

CREATE POLICY "Public read hero-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hero-images');

CREATE POLICY "Public read banners"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

CREATE POLICY "Public read testimonials"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'testimonials');

-- Authenticated write policies
CREATE POLICY "Auth upload product-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Auth upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "Auth upload hero-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hero-images');

CREATE POLICY "Auth upload banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'banners');

CREATE POLICY "Auth upload testimonials"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'testimonials');

-- Authenticated update/delete
CREATE POLICY "Auth update storage objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Auth delete storage objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (true);
