/*
  # Fix verify_admin_credentials - ambiguous column reference

  ## Problem
  The function has `RETURNS TABLE(... email text ...)` which creates a PL/pgSQL variable
  named `email` that conflicts with `employees.email` in the UPDATE statement, causing:
  "column reference email is ambiguous"

  This made login always fail with an empty result set.

  ## Fix
  Qualify all `employees.email` references with the table name in the UPDATE clause,
  and use the parameter name `p_email` directly.
*/

CREATE OR REPLACE FUNCTION verify_admin_credentials(p_email text, p_password text)
RETURNS TABLE(
  id            uuid,
  email         text,
  full_name     text,
  role          text,
  permissions   jsonb,
  is_active     boolean,
  session_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text;
  v_hash  text;
  v_id    uuid;
BEGIN
  -- Verify password and get employee id
  SELECT e.id INTO v_id
  FROM employees e
  WHERE e.email = p_email
    AND e.password_hash IS NOT NULL
    AND e.password_hash = crypt(p_password, e.password_hash)
    AND e.is_active = true;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  -- Generate a new session token and store its hash
  v_token := gen_random_uuid()::text || '-' || gen_random_uuid()::text;
  v_hash  := crypt(v_token, gen_salt('bf'));

  -- Use id to avoid any column name ambiguity
  UPDATE employees e
  SET session_token_hash = v_hash
  WHERE e.id = v_id;

  -- Return employee row
  RETURN QUERY
  SELECT e.id, e.email, e.full_name, e.role, e.permissions, e.is_active, v_token
  FROM employees e
  WHERE e.id = v_id;
END;
$$;
