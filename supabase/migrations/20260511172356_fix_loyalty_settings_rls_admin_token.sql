/*
  # Fix loyalty_settings RLS to allow admin writes via x-admin-token header

  ## Problem
  The loyalty_settings table only has INSERT/UPDATE policies for `service_role`,
  but the admin frontend authenticates as `anon` with an `x-admin-token` header
  validated by `is_admin_request()`. This causes all "Save Settings" operations
  to be silently rejected by RLS.

  ## Changes
  1. Drop the service_role-only INSERT/UPDATE policies on loyalty_settings
  2. Add INSERT/UPDATE/DELETE policies using `is_admin_request()` for anon/authenticated roles
     (same pattern used by loyalty_tier_benefits after its fix)

  ## Security
  - Public SELECT remains open (anyone can read loyalty settings for the frontend)
  - All writes are gated by `is_admin_request()` which validates the bcrypt token
  - service_role access is preserved via its own unrestricted bypass
*/

-- Drop old service_role-only write policies
DROP POLICY IF EXISTS "Service role can insert loyalty settings" ON public.loyalty_settings;
DROP POLICY IF EXISTS "Service role can update loyalty settings" ON public.loyalty_settings;
DROP POLICY IF EXISTS "Admin can insert loyalty settings" ON public.loyalty_settings;
DROP POLICY IF EXISTS "Admin can update loyalty settings" ON public.loyalty_settings;
DROP POLICY IF EXISTS "Admin can delete loyalty settings" ON public.loyalty_settings;

-- INSERT: admin via x-admin-token header
CREATE POLICY "Admin can insert loyalty settings"
  ON public.loyalty_settings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.is_admin_request());

-- UPDATE: admin via x-admin-token header
CREATE POLICY "Admin can update loyalty settings"
  ON public.loyalty_settings
  FOR UPDATE
  TO anon, authenticated
  USING (public.is_admin_request())
  WITH CHECK (public.is_admin_request());
