/*
  # Seed admin employee row with session token hash

  ## Problem
  The employees table is completely empty. All previous seed migrations used UPDATE
  statements targeting rows that never existed, so they silently affected 0 rows.
  The edge function calls verify_admin_token('fixed-admin-token') which bcrypt-checks
  against session_token_hash in this table — with no rows present it always returns
  false, causing HTTP 401 on every admin operation.

  ## Fix
  INSERT the primary admin employee row using INSERT ... ON CONFLICT DO UPDATE so this
  migration is safely re-runnable. The session_token_hash is a fresh bcrypt hash of the
  literal string 'fixed-admin-token' that AdminContext.tsx sends after login.

  ## Security note
  This migration runs as the postgres superuser and bypasses RLS. The token hash is
  stored as a bcrypt digest — the plain token is never stored.
*/

INSERT INTO public.employees (
  full_name,
  email,
  phone,
  role,
  permissions,
  is_active,
  join_date,
  session_token_hash
)
VALUES (
  'Admin',
  'admin@lazurdemakeup.com',
  '',
  'admin',
  '["all"]'::jsonb,
  true,
  CURRENT_DATE,
  extensions.crypt('fixed-admin-token', extensions.gen_salt('bf'))
)
ON CONFLICT (email) DO UPDATE
  SET
    session_token_hash = extensions.crypt('fixed-admin-token', extensions.gen_salt('bf')),
    is_active          = true,
    role               = 'admin',
    permissions        = '["all"]'::jsonb,
    updated_at         = now();
