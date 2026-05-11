/*
  # Create Seasonal Campaigns System

  ## Summary
  Adds tables to support the Seasonal Campaigns admin feature.
  Admins can view upcoming occasion reminders, dismiss/snooze/complete them,
  and track campaign actions taken per occasion.

  ## New Tables

  ### campaign_occasion_overrides
  Stores per-admin overrides for built-in occasions (dismiss, snooze, complete).
  Built-in occasions are defined in app code; this table only stores mutations.

  - `id` (uuid, pk)
  - `occasion_key` (text) — stable slug matching app-side occasion definition
  - `admin_email` (text) — which admin performed the action
  - `status` (text) — 'dismissed' | 'snoozed' | 'completed'
  - `snoozed_until` (timestamptz, nullable) — set when status = 'snoozed'
  - `note` (text, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### campaign_actions
  Records quick actions taken from a reminder card (create banner, discount, etc.)

  - `id` (uuid, pk)
  - `occasion_key` (text)
  - `action_type` (text) — 'banner' | 'discount' | 'notification' | 'coupon' | 'hero_slider'
  - `admin_email` (text)
  - `metadata` (jsonb, nullable)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Admin token–based access only (is_admin_request())
*/

-- ── campaign_occasion_overrides ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_occasion_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_key  text NOT NULL,
  admin_email   text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'dismissed'
                  CHECK (status IN ('dismissed','snoozed','completed')),
  snoozed_until timestamptz,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (occasion_key, admin_email)
);

ALTER TABLE campaign_occasion_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select campaign overrides"
  ON campaign_occasion_overrides FOR SELECT
  TO anon, authenticated
  USING (is_admin_request());

CREATE POLICY "Admins can insert campaign overrides"
  ON campaign_occasion_overrides FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update campaign overrides"
  ON campaign_occasion_overrides FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete campaign overrides"
  ON campaign_occasion_overrides FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

CREATE INDEX IF NOT EXISTS campaign_overrides_key_idx ON campaign_occasion_overrides (occasion_key);

-- ── campaign_actions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_key text NOT NULL,
  action_type  text NOT NULL
                 CHECK (action_type IN ('banner','discount','notification','coupon','hero_slider')),
  admin_email  text NOT NULL DEFAULT '',
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaign_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select campaign actions"
  ON campaign_actions FOR SELECT
  TO anon, authenticated
  USING (is_admin_request());

CREATE POLICY "Admins can insert campaign actions"
  ON campaign_actions FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE INDEX IF NOT EXISTS campaign_actions_key_idx ON campaign_actions (occasion_key);
CREATE INDEX IF NOT EXISTS campaign_actions_created_idx ON campaign_actions (created_at DESC);
