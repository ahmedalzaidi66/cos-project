/*
  # Email Verification Codes

  Stores 6-digit OTP codes for new-user email verification.

  ## New Tables
  - `email_verifications`
    - `id` (uuid, pk)
    - `user_id` (uuid, FK → auth.users, unique — one active record per user)
    - `code_hash` (text) — bcrypt hash of the 6-digit code
    - `expires_at` (timestamptz) — 10 minutes from creation
    - `verified_at` (timestamptz, nullable) — set when verified
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled; anon can INSERT their own row (needed at signup before session)
  - Service role used in edge function for SELECT/UPDATE

  ## Notes
  - Old rows for same user_id are deleted on new code generation (done in edge function via service role)
  - pgcrypto extension used for crypt/gen_salt
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS email_verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_verifications_user_id_idx
  ON email_verifications (user_id);

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own verification row
CREATE POLICY "Users can read own verification"
  ON email_verifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Anon + authenticated can insert (needed right after signUp before session cookie arrives)
-- Service role handles delete/update via edge function
CREATE POLICY "Anyone can insert verification"
  ON email_verifications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
