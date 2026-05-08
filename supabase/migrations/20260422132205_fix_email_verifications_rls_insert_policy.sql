/*
  # Fix email_verifications INSERT policy

  ## Problem
  The existing "Anyone can insert verification" policy uses WITH CHECK (true),
  granting unrestricted INSERT to anon and authenticated roles — a security risk.

  ## Fix
  - Drop the always-true policy.
  - Add a restricted policy: only authenticated users may insert a row where
    user_id matches their own auth.uid().
  - Anon access is removed entirely; the edge function that generates codes uses
    the service role key, which bypasses RLS, so anon INSERT is never needed.
*/

DROP POLICY IF EXISTS "Anyone can insert verification" ON email_verifications;

CREATE POLICY "Users can insert own verification"
  ON email_verifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
