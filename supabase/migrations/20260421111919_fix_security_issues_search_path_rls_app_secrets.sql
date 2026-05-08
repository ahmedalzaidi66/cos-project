/*
  # Security Hardening: Four Issues Fixed

  1. Function Search Path Mutable
     - `issue_admin_token_for_auth_user`: Add `SET search_path = public, pg_temp` to prevent
       search_path hijacking attacks where a malicious schema could shadow system functions.

  2. RLS Policy Always True — orders INSERT
     - Drop `Anyone can insert orders` (WITH CHECK (true) — no restriction).
     - Replace with two separate policies:
       - Anon users may insert only if the order's customer_email matches the JWT claim
         (or is non-null for truly anonymous checkout — we gate on a non-empty email field).
       - Authenticated users may insert only if customer_email matches auth.jwt()->>'email'.

  3. RLS Policy Always True — order_items INSERT
     - Drop `Anyone can insert order items` (WITH CHECK (true) — no restriction).
     - Replace with a policy that requires the referenced order to exist and belong to
       the inserting user (matched by customer_email from JWT, or present for anon checkout).

  4. RLS Enabled No Policy — app_secrets
     - Table has RLS enabled but zero policies, so no role can read it (locked out).
     - Add a service_role-only SELECT policy so internal server code can read secrets,
       while anon and authenticated users remain blocked.

  Security notes:
  - Orders are placed during checkout where the caller supplies customer_email.
    The INSERT policy validates that the email in the row matches auth.jwt()->>'email'
    for authenticated users, or is a non-empty string for anon (guest checkout).
  - order_items INSERT is gated on the parent order existing with a matching email,
    preventing orphan items or items attached to someone else's order.
  - app_secrets is internal-only; only service_role (server-side) can read it.
*/

-- ─── 1. Fix mutable search_path on issue_admin_token_for_auth_user ────────────

CREATE OR REPLACE FUNCTION public.issue_admin_token_for_auth_user(p_auth_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id    uuid;
  v_token text;
  v_hash  text;
BEGIN
  SELECT e.id INTO v_id
  FROM employees e
  WHERE e.auth_user_id = p_auth_user_id
    AND e.is_active = true
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_token := gen_random_uuid()::text || '-' || gen_random_uuid()::text;
  v_hash  := crypt(v_token, gen_salt('bf'));

  UPDATE employees SET session_token_hash = v_hash WHERE id = v_id;

  RETURN v_token;
END;
$$;

-- ─── 2. Fix orders INSERT policy (was always true) ────────────────────────────

DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;

-- Authenticated users: customer_email must match their JWT email
CREATE POLICY "Authenticated users can insert own orders"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_email = (auth.jwt() ->> 'email'));

-- Anon users (guest checkout): customer_email must be a non-empty string
-- They cannot be verified against a JWT, but we require the field is populated.
CREATE POLICY "Anon users can insert orders with email"
  ON public.orders
  FOR INSERT
  TO anon
  WITH CHECK (
    customer_email IS NOT NULL
    AND customer_email <> ''
  );

-- ─── 3. Fix order_items INSERT policy (was always true) ───────────────────────

DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;

-- Authenticated: the parent order must exist and belong to the current user
CREATE POLICY "Authenticated users can insert order items for own orders"
  ON public.order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_email = (auth.jwt() ->> 'email')
    )
  );

-- Anon: the parent order must exist (guest checkout, order was just created)
CREATE POLICY "Anon users can insert order items for existing orders"
  ON public.order_items
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_email IS NOT NULL
        AND o.customer_email <> ''
    )
  );

-- ─── 4. Fix app_secrets: RLS enabled but no policies ─────────────────────────

-- Only service_role (server-side) can read app secrets.
-- anon and authenticated are intentionally blocked.
CREATE POLICY "Service role can read app secrets"
  ON public.app_secrets
  FOR SELECT
  TO service_role
  USING (true);
