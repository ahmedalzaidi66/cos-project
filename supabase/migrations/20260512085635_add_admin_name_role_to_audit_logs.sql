/*
  # Add admin_name and admin_role to admin_audit_logs

  ## Summary
  Adds two informational columns to the audit log table so each record carries
  the human-readable name and role of the acting admin, removing the need to
  join against the employees table just to display logs.

  ## Changes
  - `admin_audit_logs`
    - NEW `admin_name` (text, default '') — display name of the acting admin
    - NEW `admin_role` (text, default '') — role at the time of the action

  ## Notes
  - Both columns default to '' so existing rows and insert statements without
    these fields remain valid without migration errors.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_audit_logs' AND column_name = 'admin_name'
  ) THEN
    ALTER TABLE admin_audit_logs ADD COLUMN admin_name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_audit_logs' AND column_name = 'admin_role'
  ) THEN
    ALTER TABLE admin_audit_logs ADD COLUMN admin_role text NOT NULL DEFAULT '';
  END IF;
END $$;
