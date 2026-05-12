/*
  # Seed All Roles and Fix Default Permissions

  ## Summary
  - roles table was missing: admin, product_manager, order_manager, customer_support, content_editor
  - role_permissions had no unique constraint, causing duplicates
  - This migration adds the unique constraint, deduplicates, seeds all roles and their default permissions

  ## Changes
  1. Deduplicate role_permissions
  2. Add unique constraint on role_permissions(role_key, permission_key) if not exists
  3. Insert all missing roles
  4. Reseed role_permissions with sensible defaults per role
*/

-- 1. Deduplicate role_permissions before adding unique constraint
DELETE FROM role_permissions a
USING role_permissions b
WHERE a.ctid < b.ctid
  AND a.role_key = b.role_key
  AND a.permission_key = b.permission_key;

-- 2. Add unique constraint (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'role_permissions'::regclass
      AND conname = 'role_permissions_role_perm_unique'
  ) THEN
    ALTER TABLE role_permissions
      ADD CONSTRAINT role_permissions_role_perm_unique UNIQUE (role_key, permission_key);
  END IF;
END $$;

-- 3. Insert missing roles
INSERT INTO roles (key, label) VALUES
  ('admin',            'Admin'),
  ('product_manager',  'Product Manager'),
  ('order_manager',    'Order Manager'),
  ('customer_support', 'Customer Support'),
  ('content_editor',   'Content Editor')
ON CONFLICT (key) DO NOTHING;

-- 4. Clear stale default permissions for all non-locked roles then reseed
DELETE FROM role_permissions WHERE role_key IN (
  'admin', 'employee', 'product_manager', 'order_manager', 'customer_support', 'content_editor'
);

-- Admin: all permissions
INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('admin', 'view_dashboard'),
  ('admin', 'manage_analytics'),
  ('admin', 'manage_products'),
  ('admin', 'manage_categories'),
  ('admin', 'manage_orders'),
  ('admin', 'manage_customers'),
  ('admin', 'manage_loyalty'),
  ('admin', 'manage_notifications'),
  ('admin', 'manage_employees'),
  ('admin', 'manage_reviews'),
  ('admin', 'manage_coupons'),
  ('admin', 'manage_shipping'),
  ('admin', 'manage_sections'),
  ('admin', 'manage_cms'),
  ('admin', 'manage_about'),
  ('admin', 'manage_cms_builder'),
  ('admin', 'manage_layout'),
  ('admin', 'manage_theme'),
  ('admin', 'manage_settings'),
  ('admin', 'manage_permissions'),
  ('admin', 'view_audit_logs'),
  ('admin', 'manage_campaigns');

-- Employee: basic view + order/customer handling
INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('employee', 'view_dashboard'),
  ('employee', 'manage_orders'),
  ('employee', 'manage_customers');

-- Product Manager: catalog management
INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('product_manager', 'view_dashboard'),
  ('product_manager', 'manage_products'),
  ('product_manager', 'manage_categories'),
  ('product_manager', 'manage_reviews'),
  ('product_manager', 'manage_analytics');

-- Order Manager: orders, customers, shipping
INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('order_manager', 'view_dashboard'),
  ('order_manager', 'manage_orders'),
  ('order_manager', 'manage_customers'),
  ('order_manager', 'manage_shipping'),
  ('order_manager', 'manage_notifications');

-- Customer Support: customers, orders, reviews, notifications
INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('customer_support', 'view_dashboard'),
  ('customer_support', 'manage_customers'),
  ('customer_support', 'manage_orders'),
  ('customer_support', 'manage_reviews'),
  ('customer_support', 'manage_notifications');

-- Content Editor: CMS, about, sections, campaigns
INSERT INTO role_permissions (role_key, permission_key) VALUES
  ('content_editor', 'view_dashboard'),
  ('content_editor', 'manage_cms'),
  ('content_editor', 'manage_about'),
  ('content_editor', 'manage_sections'),
  ('content_editor', 'manage_cms_builder'),
  ('content_editor', 'manage_campaigns');
