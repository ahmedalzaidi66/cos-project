/*
  # Add update_role_permissions RPC

  1. New Functions
    - `update_role_permissions(p_role_key text, p_permissions text[])` — replaces all
      role_permissions rows for the given role with the supplied permission keys.
      Requires admin session token via is_admin_request().
*/

CREATE OR REPLACE FUNCTION update_role_permissions(
  p_role_key    text,
  p_permissions text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_admin_request() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Block modification of super_admin / admin defaults
  IF p_role_key IN ('super_admin', 'admin', 'user') THEN
    RAISE EXCEPTION 'Cannot modify permissions for built-in role: %', p_role_key;
  END IF;

  DELETE FROM role_permissions WHERE role_key = p_role_key;

  INSERT INTO role_permissions (role_key, permission_key)
  SELECT p_role_key, unnest(p_permissions);
END;
$$;
