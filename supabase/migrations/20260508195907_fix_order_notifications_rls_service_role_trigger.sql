/*
  # Fix order_notifications RLS for DB trigger inserts

  ## Problem
  The existing INSERT policy checks `auth.uid() = user_id`, but PostgreSQL
  SECURITY DEFINER triggers run as the function owner (typically postgres/service_role)
  — not as the customer. This means the trigger cannot insert notifications for users,
  causing silent failures when order status changes.

  ## Changes
  1. Drop the broken INSERT policy that blocks trigger inserts
  2. Add a proper service_role bypass policy so SECURITY DEFINER triggers can insert
  3. Add a separate authenticated INSERT policy so users can insert their own rows
     (needed for future app-level notification creation if required)

  ## Notes
  - `TO authenticated` policies only apply to rows inserted by authenticated users via JWT
  - `TO service_role` bypasses RLS entirely for that role — this is intentional for triggers
  - Customer SELECT and UPDATE policies remain unchanged (still user-scoped)
*/

-- Drop the broken INSERT policy
DROP POLICY IF EXISTS "Service can insert order notifications" ON order_notifications;

-- Allow SECURITY DEFINER functions (triggers running as service_role) to insert
-- Note: service_role already bypasses RLS by default in Supabase,
-- but we need to ensure the trigger function's owner role has access.
-- The trigger uses SECURITY DEFINER which runs as the function owner.
-- We grant service_role explicit insert via a permissive policy with no row restriction.
CREATE POLICY "Trigger can insert order notifications for any user"
  ON order_notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Also allow authenticated users to insert their own notifications (app-level)
CREATE POLICY "Authenticated users can insert own order notifications"
  ON order_notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
