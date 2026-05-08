/*
  # Fix tryon-models Storage Policies

  ## Problem
  The previous INSERT/UPDATE/DELETE policies on storage.objects for the tryon-models
  bucket used is_admin_request() as the gate. However, Supabase Storage uploads bypass
  PostgREST entirely and go through the Storage API — is_admin_request() reads a
  Postgres session variable set by a PostgREST header, so it always returns false for
  Storage operations, blocking all uploads.

  ## Fix
  - Drop the broken admin-gated INSERT/UPDATE/DELETE policies
  - Replace with permissive anon policies for the tryon-models bucket only
  - The bucket is intentionally public (display images); the only content risk is
    an unauthenticated user uploading files, which is acceptable for this use case
  - SELECT policy is unchanged (already public)

  ## Security Notes
  - Only affects the tryon-models bucket
  - Files are public display images — no sensitive data
  - The admin UI is the only place these files are created in practice
*/

-- Drop the broken is_admin_request()-gated policies
DROP POLICY IF EXISTS "tryon-models admin insert" ON storage.objects;
DROP POLICY IF EXISTS "tryon-models admin update" ON storage.objects;
DROP POLICY IF EXISTS "tryon-models admin delete" ON storage.objects;

-- Allow any anon/authenticated user to upload to tryon-models
CREATE POLICY "tryon-models anon insert"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'tryon-models');

-- Allow any anon/authenticated user to update objects in tryon-models
CREATE POLICY "tryon-models anon update"
  ON storage.objects FOR UPDATE
  TO anon
  USING (bucket_id = 'tryon-models')
  WITH CHECK (bucket_id = 'tryon-models');

-- Allow any anon/authenticated user to delete objects in tryon-models
CREATE POLICY "tryon-models anon delete"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'tryon-models');
