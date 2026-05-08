/*
  # Virtual Try-On Model Image — Storage Bucket & Site Setting

  ## Overview
  Enables admins to upload a custom default model image for the Virtual Try-On feature
  via the admin dashboard. The image is stored in Supabase Storage and the active URL
  is persisted as a site_settings key.

  ## Changes

  ### 1. Storage Bucket
  - Creates `tryon-models` bucket (public read, admin write)
  - RLS: anyone can read objects; only is_admin_request() can insert/update/delete

  ### 2. Site Settings Seed
  - Inserts the key `tryon_model_image_url` with an empty default value
  - If already present, does nothing (ON CONFLICT DO NOTHING)

  ## Security
  - Public reads are safe — these are display images
  - Writes require the admin token header (is_admin_request() RLS guard)
*/

-- Create the storage bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('tryon-models', 'tryon-models', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public reads on objects in tryon-models
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'tryon-models public read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "tryon-models public read"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'tryon-models')
    $policy$;
  END IF;
END $$;

-- Allow admin uploads (insert) to tryon-models
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'tryon-models admin insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "tryon-models admin insert"
        ON storage.objects FOR INSERT
        TO anon
        WITH CHECK (
          bucket_id = 'tryon-models'
          AND public.is_admin_request()
        )
    $policy$;
  END IF;
END $$;

-- Allow admin updates to tryon-models
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'tryon-models admin update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "tryon-models admin update"
        ON storage.objects FOR UPDATE
        TO anon
        USING (
          bucket_id = 'tryon-models'
          AND public.is_admin_request()
        )
        WITH CHECK (
          bucket_id = 'tryon-models'
          AND public.is_admin_request()
        )
    $policy$;
  END IF;
END $$;

-- Allow admin deletes in tryon-models
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'tryon-models admin delete'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "tryon-models admin delete"
        ON storage.objects FOR DELETE
        TO anon
        USING (
          bucket_id = 'tryon-models'
          AND public.is_admin_request()
        )
    $policy$;
  END IF;
END $$;

-- Seed the setting key so the frontend can always read it
INSERT INTO site_settings (key, value, updated_at)
VALUES ('tryon_model_image_url', '', now())
ON CONFLICT (key) DO NOTHING;
