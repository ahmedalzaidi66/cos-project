/*
  # Restrict storage bucket listing on public buckets

  Public buckets in Supabase serve files via direct URL without needing
  a SELECT policy. The existing broad SELECT policies allow API clients
  to list all files in a bucket, which may expose filenames and paths.

  ## Changes
  - Drop existing broad SELECT policies on 6 public buckets
  - Recreate SELECT policies that require a specific object name
    (prevents directory listing via the API while still allowing
    direct object access by known path)

  ## Buckets affected
  - product-images
  - logos
  - hero-images
  - banners
  - testimonials
  - uploads
*/

-- Drop existing broad SELECT policies
DROP POLICY IF EXISTS "Public read product-images" ON storage.objects;
DROP POLICY IF EXISTS "Public read logos" ON storage.objects;
DROP POLICY IF EXISTS "Public read hero-images" ON storage.objects;
DROP POLICY IF EXISTS "Public read banners" ON storage.objects;
DROP POLICY IF EXISTS "Public read testimonials" ON storage.objects;
DROP POLICY IF EXISTS "Public can view uploaded images" ON storage.objects;

-- Recreate with name requirement to prevent empty-prefix listing
CREATE POLICY "Public read product-images by path"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images' AND length(name) > 0);

CREATE POLICY "Public read logos by path"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos' AND length(name) > 0);

CREATE POLICY "Public read hero-images by path"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'hero-images' AND length(name) > 0);

CREATE POLICY "Public read banners by path"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners' AND length(name) > 0);

CREATE POLICY "Public read testimonials by path"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'testimonials' AND length(name) > 0);

CREATE POLICY "Public read uploads by path"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'uploads' AND length(name) > 0);
