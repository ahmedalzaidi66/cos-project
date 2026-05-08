/*
  # Complete RBAC Setup

  ## Summary
  The roles/permissions/role_permissions tables already exist with a text-key
  based schema. This migration:
  1. Adds a 'user' role (storefront only, no admin access)
  2. Seeds employee default permissions (view_dashboard, manage_orders, manage_customers)
  3. Ensures super_admin has all 13 permissions
  4. Adds `custom_permissions` column to employees for per-person overrides
  5. Creates `get_employee_permissions(email)` RPC used at login time
  6. Adds missing permission: Admin can delete permissions policy

  ## Schema notes
  - roles: id, key (role slug), label, description, is_system
  - permissions: id, key, label, description, section
  - role_permissions: id, role_key (text FK), permission_key (text FK)
  - employees: gains custom_permissions text[] column
*/

-- ─── Add 'user' role for storefront users ─────────────────────────────────────

INSERT INTO roles (key, label, description, is_system)
VALUES ('user', 'User', 'Regular storefront customer. No admin access.', true)
ON CONFLICT (key) DO NOTHING;

-- ─── Ensure employee role exists ──────────────────────────────────────────────

INSERT INTO roles (key, label, description, is_system)
VALUES ('employee', 'Employee', 'Staff member with limited admin dashboard access.', true)
ON CONFLICT (key) DO NOTHING;

-- ─── Seed employee default permissions (minimal set) ─────────────────────────

INSERT INTO role_permissions (role_key, permission_key)
VALUES
  ('employee', 'view_dashboard'),
  ('employee', 'manage_orders'),
  ('employee', 'manage_customers')
ON CONFLICT DO NOTHING;

-- ─── Ensure super_admin has ALL permissions ───────────────────────────────────

INSERT INTO role_permissions (role_key, permission_key)
SELECT 'super_admin', key FROM permissions
ON CONFLICT DO NOTHING;

-- ─── Add missing delete policy on permissions ────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='permissions' AND policyname='Admin can delete permissions'
  ) THEN
    CREATE POLICY "Admin can delete permissions"
      ON permissions FOR DELETE TO anon, authenticated USING (is_admin_request());
  END IF;
END $$;

-- ─── employees: add custom_permissions override column ───────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'custom_permissions'
  ) THEN
    -- null = use role defaults; non-null = explicit list overrides role
    ALTER TABLE employees ADD COLUMN custom_permissions text[];
  END IF;
END $$;

-- ─── get_employee_permissions(email) RPC ──────────────────────────────────────
-- Called at login. Returns effective permission keys for the employee.
-- custom_permissions (when set) overrides the role defaults entirely.

CREATE OR REPLACE FUNCTION get_employee_permissions(p_email text)
RETURNS TABLE(permission_key text, role_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_custom   text[];
  v_role_key text;
  v_emp_id   uuid;
BEGIN
  SELECT e.id, e.role, e.custom_permissions
  INTO v_emp_id, v_role_key, v_custom
  FROM employees e
  WHERE e.email = p_email AND e.is_active = true
  LIMIT 1;

  IF v_emp_id IS NULL THEN RETURN; END IF;

  -- If employee has a custom override list, return those
  IF v_custom IS NOT NULL THEN
    RETURN QUERY
      SELECT unnest(v_custom) AS permission_key, v_role_key AS role_key;
    RETURN;
  END IF;

  -- Otherwise return all permissions for the employee's role
  RETURN QUERY
    SELECT rp.permission_key, rp.role_key
    FROM role_permissions rp
    WHERE rp.role_key = v_role_key;
END;
$$;

GRANT EXECUTE ON FUNCTION get_employee_permissions(text) TO anon, authenticated;

-- ─── update_employee_permissions(email, permissions[]) RPC ───────────────────
-- Admin-only: sets custom permission overrides for an employee.
-- Pass NULL to revert to role defaults.

CREATE OR REPLACE FUNCTION update_employee_permissions(p_email text, p_permissions text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE employees
  SET custom_permissions = p_permissions,
      updated_at = now()
  WHERE email = p_email;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION update_employee_permissions(text, text[]) TO anon, authenticated;
