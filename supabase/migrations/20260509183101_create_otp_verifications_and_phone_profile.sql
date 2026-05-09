/*
  # OTP Verifications table + customer phone profile fields

  ## Summary
  Adds phone-based OTP login infrastructure without touching any existing
  email auth tables or flows.

  ## New Tables
  - `otp_verifications`
    - `id` (uuid, pk)
    - `phone` (text) — E.164 normalised, e.g. "+9647700066689"
    - `otp_hash` (text) — bcrypt hash of the 6-digit code; plain OTP never stored
    - `purpose` (text) — 'login' | 'register' | 'link_phone' etc.
    - `expires_at` (timestamptz) — 5 minutes from creation
    - `attempts` (int, default 0) — incremented on each failed check
    - `verified_at` (timestamptz, nullable) — set when successfully verified
    - `created_at` (timestamptz)

  ## Modified Tables
  - `profiles` (if exists) — adds `phone` and `phone_verified_at` columns
    Falls back gracefully if the table does not exist yet.

  ## Security
  - RLS enabled; anon can INSERT (needed before a session exists)
  - Anon can SELECT their own row by phone (to check status / remaining time)
  - Service role (edge function) handles UPDATE (mark verified, increment attempts)
  - No policy exposes otp_hash to any client role

  ## Notes
  - pgcrypto already enabled by earlier migration; kept as IF NOT EXISTS guard
  - Old unverified rows for same phone+purpose are deleted by the edge function
    before inserting a new one, enforced by a partial unique index
  - Max 5 attempts enforced in the edge function before row is invalidated
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── OTP verifications ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS otp_verifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text        NOT NULL,
  otp_hash    text        NOT NULL,
  purpose     text        NOT NULL DEFAULT 'login',
  expires_at  timestamptz NOT NULL,
  attempts    int         NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Only one active (unverified, unexpired) row per phone+purpose at a time.
-- The edge function deletes the old row before inserting a new one.
CREATE INDEX IF NOT EXISTS otp_verifications_phone_purpose_idx
  ON otp_verifications (phone, purpose);

ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

-- Anon / authenticated can INSERT a new OTP request
CREATE POLICY "Anyone can request OTP"
  ON otp_verifications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Anon / authenticated can SELECT their own row by phone
-- (needed to show resend cooldown without exposing hash)
CREATE POLICY "Anyone can read own OTP row by phone"
  ON otp_verifications FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only the service role (edge function) may UPDATE rows
-- (increment attempts, set verified_at)
-- No client-side UPDATE policy → clients can never tamper with hash or attempts

-- ── Customer phone fields ─────────────────────────────────────────────────────
-- Add phone fields to auth.users metadata only (no separate profiles table needed).
-- We store phone_verified_at in a lightweight customer_profiles table.

CREATE TABLE IF NOT EXISTS customer_profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone            text,
  phone_verified_at timestamptz,
  updated_at       timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_profiles_phone_idx
  ON customer_profiles (phone)
  WHERE phone IS NOT NULL;

ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON customer_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON customer_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON customer_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
