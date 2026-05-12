/*
  # Fix loyalty trigger — wrap award call in exception handler

  ## Problem
  If `award_loyalty_points_for_order` raises any uncaught exception (even after
  the idempotency fixes), the exception propagates through the trigger and aborts
  the entire `UPDATE orders SET status = 'delivered'` transaction.

  This means the order status NEVER saves when loyalty processing fails.

  ## Fix
  Wrap the `PERFORM award_loyalty_points_for_order(NEW.id)` call in a
  BEGIN ... EXCEPTION block so any error is logged to the PostgreSQL log but
  does NOT roll back the order status update.

  The order status change is the primary operation and must always succeed.
  Loyalty is a secondary side-effect that can safely be retried manually.

  ## No destructive changes
  - Unique constraint stays enabled
  - Existing transaction rows unchanged
  - Trigger still fires on status changes
  - revert_loyalty_points_for_order is also protected
*/

CREATE OR REPLACE FUNCTION trg_loyalty_on_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: no-op if status hasn't actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Award points when order is delivered (wrapped so errors never abort the status update)
  IF NEW.status = 'delivered' THEN
    BEGIN
      PERFORM award_loyalty_points_for_order(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      -- Log but never abort: loyalty is a side-effect, status update must succeed
      RAISE WARNING 'award_loyalty_points_for_order failed for order %: % %',
        NEW.id, SQLERRM, SQLSTATE;
    END;
  END IF;

  -- Revert points when order is cancelled (also wrapped for safety)
  IF NEW.status = 'cancelled' THEN
    BEGIN
      PERFORM revert_loyalty_points_for_order(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'revert_loyalty_points_for_order failed for order %: % %',
        NEW.id, SQLERRM, SQLSTATE;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger to pick up the updated function
DROP TRIGGER IF EXISTS trg_loyalty_order_lifecycle ON orders;

CREATE TRIGGER trg_loyalty_order_lifecycle
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trg_loyalty_on_order_status_change();
