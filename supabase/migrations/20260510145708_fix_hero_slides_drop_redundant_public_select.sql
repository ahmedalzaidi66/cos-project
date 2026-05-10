/*
  # Drop redundant public SELECT policy on hero_slides

  The "Admins can read all hero slides" policy already handles the public case
  with `is_admin_request() OR is_active = true`, making the original
  "Public can read active hero slides" policy redundant. Having two overlapping
  SELECT policies on the same table/roles is harmless but confusing — remove the
  old one for clarity.
*/

DROP POLICY IF EXISTS "Public can read active hero slides" ON hero_slides;
