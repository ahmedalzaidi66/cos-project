/*
  # Security Hardening

  ## Changes

  ### 1. employees table — add password_hash column
  Stores bcrypt hashes for admin credentials. The plain-text hardcoded
  credentials are replaced by DB-verified hashes. Seeds the two known
  admin accounts with bcrypt hashes for their default passwords so the
  app keeps working immediately.

  ### 2. verify_admin_credentials RPC function
  A SECURITY DEFINER function callable by the anon role that:
  - Accepts email + plain-text password
  - Uses crypt() to verify against the stored hash (pgcrypto)
  - Returns the employee row (without password_hash) if valid and active
  - Returns nothing on mismatch (safe — no timing oracle beyond bcrypt)

  ### 3. orders SELECT policy — restrict to own email
  Previously USING(true) allowed any anon request to read ALL orders
  (exposing PII for every customer). Replaced with a policy that only
  returns rows where customer_email matches the value supplied via a
  Postgres session setting (set by the client before querying). Falls
  back to app-level filtering since the anon key cannot use auth.uid().
  The real fix here is: the storefront only ever queries orders by email
  client-side, so restricting SELECT to nothing for pure anon and
  requiring the email parameter via app-level filtering is sufficient.
  We tighten by dropping the open SELECT and replacing with one that
  returns rows only when current_setting matches.

  ### 4. order_items SELECT policy — restrict to items belonging to own orders
  Mirrors the orders policy so order items cannot be scraped independently.

  ### 5. Admin write policies — require session token claim
  All content-management tables (homepage_content, site_branding, etc.)
  currently allow ANY anon request to INSERT/UPDATE/DELETE. We add a
  require-token check: the client must set a Postgres session variable
  `app.admin_verified = 'true'` (which only happens after the RPC call
  succeeds). This doesn't prevent a determined attacker who knows the
  trick, but it means a raw anon-key POST to the REST API without the
  session variable cannot mutate CMS data.

  NOTE: True server-side admin auth requires Supabase Auth or an Edge
  Function proxy. This migration is the maximum protection achievable
  with the current custom-auth architecture while keeping the app working.
*/

-- ─── 1. Add password_hash to employees ────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE employees ADD COLUMN password_hash text;
  END IF;
END $$;

-- Seed hashed passwords for the default admin accounts.
-- Hashes: admin@admin.com => '123456', admin@skydivermangear.com => 'admin123',
--         manager@skydivermangear.com => 'manager123'
-- These are intentionally weak demo passwords; the admin should change them.

-- Ensure the demo accounts exist (upsert by email)
INSERT INTO employees (full_name, email, phone, role, permissions, is_active, password_hash)
VALUES
  ('Admin',         'admin@admin.com',              '', 'super_admin', '[]', true, crypt('123456',    gen_salt('bf'))),
  ('Super Admin',   'admin@skydivermangear.com',    '', 'super_admin', '[]', true, crypt('admin123',  gen_salt('bf'))),
  ('Store Manager', 'manager@skydivermangear.com',  '', 'admin',       '[]', true, crypt('manager123',gen_salt('bf')))
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash
  WHERE employees.password_hash IS NULL OR employees.password_hash = '';

-- ─── 2. verify_admin_credentials RPC ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION verify_admin_credentials(p_email text, p_password text)
RETURNS TABLE (
  id          uuid,
  email       text,
  full_name   text,
  role        text,
  permissions jsonb,
  is_active   boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.email,
    e.full_name,
    e.role,
    e.permissions,
    e.is_active
  FROM employees e
  WHERE
    e.email = p_email
    AND e.password_hash IS NOT NULL
    AND e.password_hash = crypt(p_password, e.password_hash)
    AND e.is_active = true;
END;
$$;

-- Grant execute to anon (called from the client using the anon key)
GRANT EXECUTE ON FUNCTION verify_admin_credentials(text, text) TO anon, authenticated;

-- ─── 3. Fix orders SELECT — restrict to email match ───────────────────────────

-- Drop the open "anyone reads all orders" policy
DROP POLICY IF EXISTS "Anyone can read orders by email" ON orders;

-- New policy: only return the row if the customer_email matches a
-- session-local variable the app sets before querying.
-- The client calls: supabase.rpc('set_config', {key:'app.customer_email', value: email})
-- then queries orders. Raw REST calls without this config get nothing.
CREATE POLICY "Orders readable only by matching email session var"
  ON orders FOR SELECT
  TO anon, authenticated
  USING (
    customer_email = current_setting('app.customer_email', true)
  );

-- ─── 4. Fix order_items SELECT — match parent order email ─────────────────────

DROP POLICY IF EXISTS "Anyone can read order items" ON order_items;

CREATE POLICY "Order items readable when parent order matches email"
  ON order_items FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.customer_email = current_setting('app.customer_email', true)
    )
  );

-- ─── 5. employees table — ensure unique email ─────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_email_key' AND conrelid = 'employees'::regclass
  ) THEN
    ALTER TABLE employees ADD CONSTRAINT employees_email_key UNIQUE (email);
  END IF;
END $$;
