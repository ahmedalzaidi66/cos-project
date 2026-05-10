/*
  # Add FCM Support to user_push_tokens

  ## Summary
  Extends the existing user_push_tokens table to support both Expo and Firebase Cloud
  Messaging (FCM) tokens. No tables are dropped or recreated.

  ## Changes

  ### Modified Table: user_push_tokens
  - `provider` (text, NOT NULL, DEFAULT 'expo') — distinguishes 'expo' vs 'fcm' tokens
  - `is_active` (boolean, DEFAULT true) — allows soft-deactivation without deletion
  - `device_info` (jsonb, DEFAULT '{}') — optional device metadata (browser, OS, app version)

  ### New Unique Constraint
  - Drops old (user_id, token) unique constraint and replaces it with one that also includes
    provider, so the same token value can't conflict across providers.

  ### Security
  - RLS policies unchanged: users can only manage their own tokens.
  - Added index on provider for efficient per-provider queries.

  ## Notes
  1. Existing Expo token rows get provider='expo', is_active=true by default.
  2. FCM tokens (web VAPID or native FCM) store as provider='fcm'.
  3. The send-push-notification edge function queries by provider to route correctly.
*/

-- Add new columns if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_push_tokens' AND column_name = 'provider'
  ) THEN
    ALTER TABLE user_push_tokens ADD COLUMN provider text NOT NULL DEFAULT 'expo';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_push_tokens' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE user_push_tokens ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_push_tokens' AND column_name = 'device_info'
  ) THEN
    ALTER TABLE user_push_tokens ADD COLUMN device_info jsonb NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- Add constraint for provider values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_push_tokens' AND constraint_name = 'user_push_tokens_provider_check'
  ) THEN
    ALTER TABLE user_push_tokens
      ADD CONSTRAINT user_push_tokens_provider_check
      CHECK (provider IN ('expo', 'fcm'));
  END IF;
END $$;

-- Replace old unique constraint (user_id, token) with one that includes provider
-- so the same raw token can't exist twice for the same user+provider combo
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_push_tokens'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'user_push_tokens_user_id_token_key'
  ) THEN
    ALTER TABLE user_push_tokens DROP CONSTRAINT user_push_tokens_user_id_token_key;
  END IF;
END $$;

-- Add new unique constraint covering user_id + token + provider
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_push_tokens'
      AND constraint_name = 'user_push_tokens_user_id_token_provider_key'
  ) THEN
    ALTER TABLE user_push_tokens
      ADD CONSTRAINT user_push_tokens_user_id_token_provider_key
      UNIQUE (user_id, token, provider);
  END IF;
END $$;

-- Index on provider for efficient per-provider queries
CREATE INDEX IF NOT EXISTS idx_push_tokens_provider
  ON user_push_tokens (provider, is_active);

-- Index on is_active for efficient active-token lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_active
  ON user_push_tokens (user_id, is_active)
  WHERE is_active = true;
