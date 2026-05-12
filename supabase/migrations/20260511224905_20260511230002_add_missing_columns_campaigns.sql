/*
  # Add missing columns to existing seasonal campaign tables

  Extends seasonal_events, seasonal_campaigns, and campaign_reminders
  with columns needed for the enhanced campaigns UI:
  - seasonal_events: status column, suggested_themes
  - seasonal_campaigns: suggested_themes array
  - campaign_reminders: status column (pending/sent/dismissed), sent_at
*/

-- seasonal_events: add status if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seasonal_events' AND column_name='is_active') THEN
    ALTER TABLE seasonal_events ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- seasonal_campaigns: add suggested_themes if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seasonal_campaigns' AND column_name='suggested_themes') THEN
    ALTER TABLE seasonal_campaigns ADD COLUMN suggested_themes jsonb NOT NULL DEFAULT '[]';
  END IF;
END $$;

-- campaign_reminders: add status column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaign_reminders' AND column_name='status') THEN
    ALTER TABLE campaign_reminders ADD COLUMN status text NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'sent', 'dismissed'));
  END IF;
END $$;

-- campaign_reminders: add sent_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaign_reminders' AND column_name='sent_at') THEN
    ALTER TABLE campaign_reminders ADD COLUMN sent_at timestamptz;
  END IF;
END $$;

-- campaign_reminders: add updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaign_reminders' AND column_name='updated_at') THEN
    ALTER TABLE campaign_reminders ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seasonal_events_is_active  ON seasonal_events(is_active);
CREATE INDEX IF NOT EXISTS idx_seasonal_campaigns_status2 ON seasonal_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_reminders_status2 ON campaign_reminders(status);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_seasonal_events_updated_at') THEN
    CREATE TRIGGER trg_seasonal_events_updated_at
      BEFORE UPDATE ON seasonal_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_seasonal_campaigns_updated_at') THEN
    CREATE TRIGGER trg_seasonal_campaigns_updated_at
      BEFORE UPDATE ON seasonal_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_campaign_reminders_updated_at') THEN
    CREATE TRIGGER trg_campaign_reminders_updated_at
      BEFORE UPDATE ON campaign_reminders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
