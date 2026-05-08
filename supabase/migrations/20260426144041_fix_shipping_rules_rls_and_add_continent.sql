/*
  # Fix shipping_rules RLS and add continent column

  ## Problems fixed
  1. The original migration granted write access only to `service_role`, but the
     admin panel uses the anon key + x-admin-token header verified by
     `is_admin_request()`. Replacing service_role policies with is_admin_request()
     so the admin UI can insert/update/delete rules.

  2. Added `continent` column so rules can be scoped to a whole continent
     (e.g. continent = "Asia", country = "all") in addition to country / governorate / area.

  ## Changes
  - Drop the three service_role write policies on shipping_rules
  - Create new INSERT / UPDATE / DELETE policies using is_admin_request()
  - Add `continent` text column (default '') to shipping_rules
*/

-- Drop the old service_role-only policies
DROP POLICY IF EXISTS "Service role can insert shipping rules"  ON public.shipping_rules;
DROP POLICY IF EXISTS "Service role can update shipping rules"  ON public.shipping_rules;
DROP POLICY IF EXISTS "Service role can delete shipping rules"  ON public.shipping_rules;

-- Also drop the old anon/authenticated SELECT policy so we can recreate cleanly
DROP POLICY IF EXISTS "Anyone can view active shipping rules" ON public.shipping_rules;

-- Allow anon + authenticated to read all rows (checkout needs inactive rules too
-- for admin preview; active filtering is done in app code)
CREATE POLICY "Public can read shipping rules"
  ON public.shipping_rules
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin writes use is_admin_request() — same pattern as every other admin table
CREATE POLICY "Admins can insert shipping rules"
  ON public.shipping_rules
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update shipping rules"
  ON public.shipping_rules
  FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete shipping rules"
  ON public.shipping_rules
  FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- Add continent column for continent-wide rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipping_rules' AND column_name = 'continent'
  ) THEN
    ALTER TABLE public.shipping_rules ADD COLUMN continent text NOT NULL DEFAULT '';
  END IF;
END $$;
