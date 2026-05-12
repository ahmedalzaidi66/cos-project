/*
  # Add campaign_banners table and extend campaign_reminders

  ## New Tables
  - `campaign_banners`
    - `id` (uuid, pk)
    - `occasion_key` (text) — links to OCCASIONS constant
    - `title` (text) — banner headline
    - `cta_text` (text) — call-to-action button text
    - `image_url` (text) — optional image URL
    - `start_date` (date) — when banner goes live
    - `end_date` (date) — when banner expires
    - `notes` (text)
    - `admin_email` (text)
    - `created_at`, `updated_at`

  ## Modified Tables
  - `campaign_reminders`: adds `reminder_date` column (timestamptz)
    and ensures status supports 'scheduled' value

  ## Security
  - RLS enabled on campaign_banners, admin-only via is_admin_request()
*/

-- ── campaign_banners ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_banners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_key text NOT NULL,
  title        text NOT NULL DEFAULT '',
  cta_text     text NOT NULL DEFAULT '',
  image_url    text NOT NULL DEFAULT '',
  start_date   date,
  end_date     date,
  notes        text NOT NULL DEFAULT '',
  admin_email  text NOT NULL DEFAULT '',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_banners_occasion_key_idx ON campaign_banners (occasion_key);
CREATE INDEX IF NOT EXISTS campaign_banners_admin_email_idx  ON campaign_banners (admin_email);

ALTER TABLE campaign_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select campaign_banners"
  ON campaign_banners FOR SELECT TO authenticated
  USING (is_admin_request());

CREATE POLICY "Admin insert campaign_banners"
  ON campaign_banners FOR INSERT TO authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admin update campaign_banners"
  ON campaign_banners FOR UPDATE TO authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Admin delete campaign_banners"
  ON campaign_banners FOR DELETE TO authenticated
  USING (is_admin_request());

CREATE POLICY "Anon select campaign_banners"
  ON campaign_banners FOR SELECT TO anon
  USING (is_admin_request());

CREATE POLICY "Anon insert campaign_banners"
  ON campaign_banners FOR INSERT TO anon
  WITH CHECK (is_admin_request());

CREATE POLICY "Anon update campaign_banners"
  ON campaign_banners FOR UPDATE TO anon
  USING (is_admin_request()) WITH CHECK (is_admin_request());

CREATE POLICY "Anon delete campaign_banners"
  ON campaign_banners FOR DELETE TO anon
  USING (is_admin_request());

-- ── campaign_reminders: add reminder_date if missing ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_reminders' AND column_name = 'reminder_date'
  ) THEN
    ALTER TABLE campaign_reminders ADD COLUMN reminder_date timestamptz;
  END IF;
END $$;

-- Add index on reminder_date
CREATE INDEX IF NOT EXISTS campaign_reminders_reminder_date_idx ON campaign_reminders (reminder_date);
