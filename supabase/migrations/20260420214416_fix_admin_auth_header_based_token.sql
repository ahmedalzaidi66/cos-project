/*
  # Fix admin auth: header-based session token

  ## Problem
  The previous approach used `set_config('app.admin_verified', 'true', true)` (transaction-local).
  Because Supabase JS sends each query as a separate HTTP request (separate transaction), the
  flag is gone by the time the actual INSERT/UPDATE/DELETE runs — so all admin writes silently fail
  RLS and return no error (the update succeeds structurally but 0 rows are affected).

  ## Solution
  1. Add `session_token_hash text` column to `employees`.
  2. `verify_admin_credentials` generates a token, bcrypt-hashes it, stores hash on the employee row,
     and returns the raw token to the client.
  3. `is_admin_request()` reads `request.headers` (set by PostgREST on every HTTP request), extracts
     `x-admin-token`, and checks it against the stored hash on the matching employee row.
     This works across every request without any per-request RPC call.
  4. Drop the old `set_admin_token` RPC and `app_secrets` table (they are no longer needed).

  ## Changes
  - New column: `employees.session_token_hash text`
  - Updated function: `verify_admin_credentials` — stores hash on employee row
  - Updated function: `is_admin_request` — checks x-admin-token header against employees table
  - Updated function: `verify_admin_credentials` — returns raw token for client storage
  - Dropped function: `set_admin_token` (no longer needed)
  - Kept: `generate_admin_session_token`, `app_secrets` (harmless, leave in place)

  ## Security
  - Token is bcrypt-hashed before storage — raw token is never in the DB
  - Token is sent via `x-admin-token` custom header on every admin Supabase request
  - `is_admin_request()` is SECURITY DEFINER so it can read employees without a SELECT policy
  - Old token is overwritten on each login — no multi-session support (intentional for simplicity)
*/

-- 1. Add session_token_hash column to employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'session_token_hash'
  ) THEN
    ALTER TABLE employees ADD COLUMN session_token_hash text;
  END IF;
END $$;

-- 2. Rewrite is_admin_request to verify x-admin-token header against employees table
CREATE OR REPLACE FUNCTION is_admin_request()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_headers    json;
  v_token      text;
  v_hash       text;
BEGIN
  -- Read PostgREST request headers (only available during HTTP requests)
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN others THEN
    v_headers := NULL;
  END;

  IF v_headers IS NULL THEN
    RETURN false;
  END IF;

  v_token := v_headers->>'x-admin-token';
  IF v_token IS NULL OR v_token = '' THEN
    RETURN false;
  END IF;

  -- Look up matching employee by token hash
  SELECT session_token_hash INTO v_hash
  FROM employees
  WHERE session_token_hash IS NOT NULL
    AND is_active = true
    AND crypt(v_token, session_token_hash) = session_token_hash
  LIMIT 1;

  RETURN v_hash IS NOT NULL;
END;
$$;

-- 3. Rewrite verify_admin_credentials to store token hash on the employee row
DROP FUNCTION IF EXISTS verify_admin_credentials(text, text);

CREATE FUNCTION verify_admin_credentials(p_email text, p_password text)
RETURNS TABLE(
  id           uuid,
  email        text,
  full_name    text,
  role         text,
  permissions  jsonb,
  is_active    boolean,
  session_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text;
  v_hash  text;
BEGIN
  -- Verify password
  IF NOT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.email = p_email
      AND e.password_hash IS NOT NULL
      AND e.password_hash = crypt(p_password, e.password_hash)
      AND e.is_active = true
  ) THEN
    RETURN;
  END IF;

  -- Generate a new session token and store its hash on the employee row
  v_token := gen_random_uuid()::text || '-' || gen_random_uuid()::text;
  v_hash  := crypt(v_token, gen_salt('bf'));

  UPDATE employees
  SET session_token_hash = v_hash
  WHERE email = p_email;

  RETURN QUERY
  SELECT e.id, e.email, e.full_name, e.role, e.permissions, e.is_active, v_token
  FROM employees e
  WHERE e.email = p_email AND e.is_active = true;
END;
$$;

-- 4. Drop set_admin_token — no longer needed
DROP FUNCTION IF EXISTS set_admin_token(text);
