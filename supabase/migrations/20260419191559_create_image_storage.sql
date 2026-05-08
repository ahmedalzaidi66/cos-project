/*
  # Create Image Storage Bucket

  1. Creates a Supabase Storage bucket called "uploads" for storing admin-uploaded images.
  2. Sets the bucket to public so uploaded images can be served via public URL.
  3. Creates RLS policies:
     - Anyone can read/view uploaded images (public storefront access)
     - Only authenticated users (admins) can upload, update, delete images
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/svg+xml','image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/svg+xml','image/gif'];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public can view uploaded images'
  ) THEN
    CREATE POLICY "Public can view uploaded images"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'uploads');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload images'
  ) THEN
    CREATE POLICY "Authenticated users can upload images"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'uploads');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can update images'
  ) THEN
    CREATE POLICY "Authenticated users can update images"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'uploads')
      WITH CHECK (bucket_id = 'uploads');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can delete images'
  ) THEN
    CREATE POLICY "Authenticated users can delete images"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'uploads');
  END IF;
END $$;
