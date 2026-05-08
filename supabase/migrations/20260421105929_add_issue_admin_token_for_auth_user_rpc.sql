/*
  # Add issue_admin_token_for_auth_user RPC

  1. New Function
    - `issue_admin_token_for_auth_user(p_auth_user_id uuid)` → text
    - Called when an employee logs in via Supabase Auth (has auth_user_id, no password_hash)
    - Generates a session token, stores its bcrypt hash on the employee row
    - Returns the plain token (to be stored client-side and sent as x-admin-token header)
    - Only succeeds for active employees whose auth_user_id matches p_auth_user_id
*/

CREATE OR REPLACE FUNCTION public.issue_admin_token_for_auth_user(p_auth_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
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
