/*
  # Add auth_user_id to employees + verify_admin_token RPC

  ## Changes
  1. New column `auth_user_id` (uuid, nullable) on `employees` — links each employee
     to their Supabase Auth account so they can sign in via the normal login screen.
  2. New function `verify_admin_token(p_token text) → boolean` — used by the
     manage-employee-auth edge function to confirm the caller holds a valid admin
     session token before performing privileged auth operations.
*/

-- 1. Add auth_user_id column (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN auth_user_id uuid;
  END IF;
END $$;

-- 2. RPC: verify_admin_token
-- Returns true when the provided raw token matches any active employee's bcrypt hash.
-- SECURITY DEFINER so the edge function (anon key) can call it safely.
CREATE OR REPLACE FUNCTION verify_admin_token(p_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN false;
  END IF;

  SELECT session_token_hash INTO v_hash
  FROM employees
  WHERE session_token_hash IS NOT NULL
    AND is_active = true
    AND crypt(p_token, session_token_hash) = session_token_hash
  LIMIT 1;

  RETURN v_hash IS NOT NULL;
END;
$$;
