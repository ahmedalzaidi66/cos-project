/*
  # Fix loyalty_tier_benefits RLS — allow admin-token writes

  ## Problem
  The previous migration only granted writes to `service_role`, but the admin
  frontend uses `adminSupabase()` which authenticates as `anon` and injects
  an `x-admin-token` header validated by `is_admin_request()`. Because no
  anon/authenticated INSERT/UPDATE/DELETE policy existed, all saves silently
  failed (RLS rejected, no error surfaced).

  ## Fix
  Add INSERT, UPDATE, DELETE policies that call `is_admin_request()` — the same
  function used by all other admin tables — so the token-based admin client can
  write. The SELECT policy already allows public reads (unchanged).

  ## Security
  - `is_admin_request()` verifies the x-admin-token header against bcrypt hashes
    in `employees.session_token_hash`. An unauthenticated caller cannot fake this.
  - Service role policy is kept for edge-function / trigger writes.
*/

-- Drop any stale duplicate policies first
DROP POLICY IF EXISTS "Admin can insert tier benefits" ON loyalty_tier_benefits;
DROP POLICY IF EXISTS "Admin can update tier benefits" ON loyalty_tier_benefits;
DROP POLICY IF EXISTS "Admin can delete tier benefits" ON loyalty_tier_benefits;

-- INSERT: admin token required
CREATE POLICY "Admin can insert tier benefits"
  ON loyalty_tier_benefits FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

-- UPDATE: admin token required
CREATE POLICY "Admin can update tier benefits"
  ON loyalty_tier_benefits FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- DELETE: admin token required
CREATE POLICY "Admin can delete tier benefits"
  ON loyalty_tier_benefits FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());
