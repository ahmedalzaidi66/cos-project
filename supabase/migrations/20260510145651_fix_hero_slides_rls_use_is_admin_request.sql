/*
  # Fix hero_slides RLS — replace service_role policies with is_admin_request()

  ## Problem
  The original hero_slides migration granted INSERT/UPDATE/DELETE only to the
  `service_role` Postgres role. The admin dashboard uses `adminSupabase()`, which
  creates a client with the anon key + `x-admin-token` header and relies on the
  `is_admin_request()` function to authorise writes — exactly the same pattern
  used by every other table (products, categories, cms_content, site_settings, etc.).
  Because `service_role` is never used by the frontend client, all writes from the
  dashboard were being rejected by RLS.

  ## Changes
  - DROP the three service_role write policies on hero_slides
  - ADD four new policies (SELECT all rows for admin, INSERT, UPDATE, DELETE)
    that use is_admin_request() — matching the pattern on every other table

  ## Security
  - Public SELECT policy (active slides only) is preserved unchanged
  - Admin writes are gated by is_admin_request(), which bcrypt-validates the
    x-admin-token header sent by adminSupabase() against the employee table
  - RLS remains enabled; no global disable
*/

-- Drop the service_role-only write policies
DROP POLICY IF EXISTS "Service role full access to hero slides"  ON hero_slides;
DROP POLICY IF EXISTS "Service role can update hero slides"      ON hero_slides;
DROP POLICY IF EXISTS "Service role can delete hero slides"      ON hero_slides;

-- Admin: read all slides (including inactive) for the editor
CREATE POLICY "Admins can read all hero slides"
  ON hero_slides FOR SELECT
  TO anon, authenticated
  USING (is_admin_request() OR is_active = true);

-- Admin: insert new slides
CREATE POLICY "Admins can insert hero slides"
  ON hero_slides FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

-- Admin: update existing slides
CREATE POLICY "Admins can update hero slides"
  ON hero_slides FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- Admin: delete slides
CREATE POLICY "Admins can delete hero slides"
  ON hero_slides FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());
