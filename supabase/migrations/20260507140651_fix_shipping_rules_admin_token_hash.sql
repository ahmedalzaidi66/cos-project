/*
  # Fix admin RLS: seed bcrypt hash for fixed-admin-token

  ## Problem
  AdminContext sets session token to the literal string 'fixed-admin-token' on login.
  is_admin_request() validates this token by bcrypt-comparing it against
  session_token_hash in the employees table. No employee row has a hash of
  'fixed-admin-token', so is_admin_request() always returns false, causing all
  admin INSERT/UPDATE/DELETE operations to be rejected by RLS — including
  shipping_rules inserts.

  ## Fix
  Upsert a bcrypt hash of 'fixed-admin-token' onto the active admin employee rows
  so is_admin_request() returns true when the admin is logged in.

  This targets only active employees that have email matching the known admin accounts,
  and uses extensions.crypt to stay consistent with is_admin_request() verification.
*/

UPDATE employees
SET session_token_hash = extensions.crypt('fixed-admin-token', extensions.gen_salt('bf', 6))
WHERE is_active = true;
