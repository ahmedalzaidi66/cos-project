/*
  # Fix verify_admin_credentials — qualify crypt() with extensions schema

  The SECURITY DEFINER function has SET search_path = public which means
  pgcrypto functions need to be called as extensions.crypt() explicitly.
  Also re-seeds password hashes using the correct schema-qualified call.
*/

-- Re-seed hashes using extensions.crypt (pgcrypto lives in extensions schema)
UPDATE employees
SET password_hash = extensions.crypt('123456',     extensions.gen_salt('bf'))
WHERE email = 'admin@admin.com';

UPDATE employees
SET password_hash = extensions.crypt('admin123',   extensions.gen_salt('bf'))
WHERE email = 'admin@skydivermangear.com';

UPDATE employees
SET password_hash = extensions.crypt('manager123', extensions.gen_salt('bf'))
WHERE email = 'manager@skydivermangear.com';

-- Recreate function with schema-qualified crypt call
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
SET search_path = public, extensions
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

GRANT EXECUTE ON FUNCTION verify_admin_credentials(text, text) TO anon, authenticated;
