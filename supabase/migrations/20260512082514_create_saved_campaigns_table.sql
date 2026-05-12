/*
  # Create saved_campaigns table

  ## Purpose
  Stores campaigns created by admins from the Seasonal Campaigns page.
  Each campaign is linked to an occasion key and has a status lifecycle:
  planned → active → completed (or dismissed).

  ## New Tables
  - `saved_campaigns`
    - `id` (uuid, primary key)
    - `occasion_key` (text) — matches keys in OCCASIONS constant
    - `title` (text) — admin-written campaign title
    - `occasion_name` (text) — occasion display name at creation time
    - `occasion_date` (date) — the occasion date at creation time
    - `notes` (text) — admin notes
    - `status` (text) — planned | active | completed | dismissed
    - `admin_email` (text) — who created it
    - `created_at`, `updated_at`

  ## Security
  - RLS enabled, admin-only access via is_admin_request() function
*/

CREATE TABLE IF NOT EXISTS saved_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_key  text NOT NULL,
  title         text NOT NULL DEFAULT '',
  occasion_name text NOT NULL DEFAULT '',
  occasion_date date,
  notes         text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned', 'active', 'completed', 'dismissed')),
  admin_email   text NOT NULL DEFAULT '',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_campaigns_occasion_key_idx ON saved_campaigns (occasion_key);
CREATE INDEX IF NOT EXISTS saved_campaigns_status_idx ON saved_campaigns (status);
CREATE INDEX IF NOT EXISTS saved_campaigns_admin_email_idx ON saved_campaigns (admin_email);

ALTER TABLE saved_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can select saved_campaigns"
  ON saved_campaigns FOR SELECT
  TO authenticated
  USING (is_admin_request());

CREATE POLICY "Admin can insert saved_campaigns"
  ON saved_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can update saved_campaigns"
  ON saved_campaigns FOR UPDATE
  TO authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin can delete saved_campaigns"
  ON saved_campaigns FOR DELETE
  TO authenticated
  USING (is_admin_request());

-- Anon select for service/edge function access patterns used by other admin tables
CREATE POLICY "Anon can select saved_campaigns"
  ON saved_campaigns FOR SELECT
  TO anon
  USING (is_admin_request());

CREATE POLICY "Anon can insert saved_campaigns"
  ON saved_campaigns FOR INSERT
  TO anon
  WITH CHECK (is_admin_request());

CREATE POLICY "Anon can update saved_campaigns"
  ON saved_campaigns FOR UPDATE
  TO anon
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Anon can delete saved_campaigns"
  ON saved_campaigns FOR DELETE
  TO anon
  USING (is_admin_request());
