/*
  # Add Granular Permissions for All Admin Sections

  Expands the permissions table to cover every admin dashboard section.

  ## New Permissions Added
  - `manage_analytics` — Analytics & Reports (general section)
  - `manage_categories` — Product Categories (catalog section)
  - `manage_loyalty` — Loyalty & Rewards (sales section)
  - `manage_notifications` — Push/In-App Notifications (sales section)
  - `manage_shipping` — Shipping Rules & Rates (sales section)
  - `manage_sections` — Homepage Section Blocks (content section)
  - `manage_about` — About Page & Contact Info (content section)

  ## Changes
  - Splits old `manage_cms` into `manage_cms` (content/CMS) + `manage_about` + `manage_sections`
  - Splits old `manage_layout` to also cover `manage_theme` separately (already existed)
  - Existing permissions remain untouched — no data loss

  ## Security
  - No RLS changes needed — existing RLS on permissions table is unchanged
*/

-- Analytics permission
INSERT INTO permissions (key, label, description, section)
VALUES ('manage_analytics', 'Analytics', 'View detailed analytics and reports', 'general')
ON CONFLICT (key) DO NOTHING;

-- Categories permission
INSERT INTO permissions (key, label, description, section)
VALUES ('manage_categories', 'Categories', 'Manage product categories and translations', 'catalog')
ON CONFLICT (key) DO NOTHING;

-- Loyalty permission
INSERT INTO permissions (key, label, description, section)
VALUES ('manage_loyalty', 'Loyalty & Rewards', 'Configure the loyalty program and points', 'sales')
ON CONFLICT (key) DO NOTHING;

-- Notifications permission
INSERT INTO permissions (key, label, description, section)
VALUES ('manage_notifications', 'Notifications', 'Send push and in-app notifications to customers', 'sales')
ON CONFLICT (key) DO NOTHING;

-- Shipping permission
INSERT INTO permissions (key, label, description, section)
VALUES ('manage_shipping', 'Shipping', 'Set shipping rates, zones and rules', 'sales')
ON CONFLICT (key) DO NOTHING;

-- Homepage sections permission (split from manage_cms)
INSERT INTO permissions (key, label, description, section)
VALUES ('manage_sections', 'Homepage Sections', 'Configure homepage section blocks and hero sliders', 'content')
ON CONFLICT (key) DO NOTHING;

-- About page permission (split from manage_cms)
INSERT INTO permissions (key, label, description, section)
VALUES ('manage_about', 'About & Contact', 'Edit about page, privacy policy, and contact info', 'content')
ON CONFLICT (key) DO NOTHING;

-- Ensure existing base permissions exist (idempotent)
INSERT INTO permissions (key, label, description, section)
VALUES
  ('view_dashboard',     'Dashboard',      'View main dashboard',                          'general'),
  ('manage_products',    'Products',        'Create, edit and delete products',             'catalog'),
  ('manage_orders',      'Orders',          'View and process customer orders',             'sales'),
  ('manage_customers',   'Customers',       'View and manage customer accounts',            'sales'),
  ('manage_employees',   'Employees',       'Add, edit and deactivate staff accounts',      'admin'),
  ('manage_reviews',     'Reviews',         'Moderate customer product reviews',            'sales'),
  ('manage_coupons',     'Coupons',         'Create and manage discount coupons',           'sales'),
  ('manage_cms',         'Content / CMS',   'Edit site content, banners and pages',         'content'),
  ('manage_cms_builder', 'Page Builder',    'Use drag-and-drop page builder',               'content'),
  ('manage_layout',      'Layout',          'Adjust layout and spacing settings',           'content'),
  ('manage_theme',       'UI Theme',        'Configure UI sizes and visual theme',          'content'),
  ('manage_settings',    'Settings',        'Change global store settings',                 'admin'),
  ('manage_permissions', 'Permissions',     'Assign roles and permissions to staff',        'admin'),
  ('view_audit_logs',    'Audit Logs',      'View admin activity and audit trail',          'admin'),
  ('manage_campaigns',   'Campaigns',       'Plan and manage seasonal campaigns',           'marketing')
ON CONFLICT (key) DO NOTHING;

-- Update 'marketing' section for campaigns if section column exists and is text
UPDATE permissions SET section = 'marketing' WHERE key = 'manage_campaigns';
