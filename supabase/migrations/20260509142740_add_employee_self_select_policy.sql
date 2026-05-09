/*
  # Allow employees to read their own row on login

  ## Problem
  AdminContext uses supabase.auth.signInWithPassword() for employee accounts, then
  immediately queries the employees table to get their role and permissions. The
  existing SELECT policy only allows is_admin_request() (x-admin-token header), which
  is not set yet at the moment of login. The query returns no rows, so the login fails.

  ## Fix
  Add a second SELECT policy that lets an authenticated user read their own employee
  row (matched by auth_user_id = auth.uid()). This is the minimum access needed for
  the login flow and does not expose other employees' rows.
*/

CREATE POLICY "Employees can read own row"
  ON employees FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());
