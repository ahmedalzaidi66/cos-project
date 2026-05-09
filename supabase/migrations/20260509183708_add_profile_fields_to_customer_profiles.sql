/*
  # Add profile fields to customer_profiles

  ## Summary
  Extends customer_profiles (created for phone-OTP users) with name, email,
  and date-of-birth columns so phone-login customers can complete their profile
  after signing in. Email-login customers use the same fields via their profile row.

  ## Changes to customer_profiles
  - `first_name` (text, nullable) — customer first name
  - `last_name`  (text, nullable) — customer last name
  - `email`      (text, nullable) — optional contact email for phone-login users
  - `date_of_birth` (date, nullable) — used for birthday promotions

  ## Notes
  - All new columns are nullable so existing rows and phone-only users are unaffected.
  - No unique constraint on email (phone users may not have one).
  - Existing RLS policies (owner read/insert/update) already cover these columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_profiles' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN first_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_profiles' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN last_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_profiles' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE customer_profiles ADD COLUMN date_of_birth date;
  END IF;
END $$;
