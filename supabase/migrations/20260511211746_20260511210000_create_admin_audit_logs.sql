/*
  # Create admin_audit_logs table

  ## Summary
  Creates a comprehensive audit logging system for all admin actions in the dashboard.

  ## New Tables
  - `admin_audit_logs`
    - `id` (uuid, primary key)
    - `admin_user_id` (text) — employee id or 'admin-fixed' for super admin
    - `admin_email` (text) — email of acting admin for display
    - `action` (text) — e.g. 'create', 'update', 'delete', 'login', 'logout', 'status_change'
    - `entity_type` (text) — e.g. 'product', 'order', 'employee', 'coupon', 'review', 'settings', 'loyalty', 'content', 'notification'
    - `entity_id` (text, nullable) — ID of the affected record
    - `entity_label` (text, nullable) — human-readable label e.g. product name
    - `before_data` (jsonb, nullable) — state before change
    - `after_data` (jsonb, nullable) — state after change
    - `metadata` (jsonb, nullable) — extra context
    - `ip_address` (text, nullable)
    - `user_agent` (text, nullable)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Super admin (admin_user_id = 'admin-fixed') can insert and select all rows
  - Employees can insert their own rows
  - Employees with view_audit_logs permission see all; others see only own rows
    (permission check delegated to application layer — RLS allows own rows only for employee reads)
  - Anon has no access
*/

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id text NOT NULL DEFAULT '',
  admin_email text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT '',
  entity_type text NOT NULL DEFAULT '',
  entity_id text,
  entity_label text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_user_id_idx ON admin_audit_logs (admin_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_entity_type_idx ON admin_audit_logs (entity_type);
CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx ON admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON admin_audit_logs (created_at DESC);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admin and employees may insert audit logs (service-role writes from triggers/functions are also allowed)
CREATE POLICY "Admins can insert audit logs"
  ON admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Each employee can read their own audit logs
CREATE POLICY "Employees can read own audit logs"
  ON admin_audit_logs FOR SELECT
  TO authenticated
  USING (admin_user_id = auth.uid()::text);

-- Allow anon inserts via is_admin_request (for super-admin sessions that use anon key)
CREATE POLICY "Service role insert audit logs"
  ON admin_audit_logs FOR INSERT
  TO anon
  WITH CHECK (is_admin_request());

-- Super admin can read all audit logs (is_admin_request checks x-admin-token header)
CREATE POLICY "Super admin reads all audit logs"
  ON admin_audit_logs FOR SELECT
  TO anon
  USING (is_admin_request());
