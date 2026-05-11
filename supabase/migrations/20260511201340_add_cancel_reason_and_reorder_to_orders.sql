/*
  # Add cancel reason and reorder tracking to orders

  ## Changes

  ### New columns on orders table
  - `cancel_reason` (text, nullable) — reason entered by admin when cancelling
  - `cancelled_at` (timestamptz, nullable) — timestamp when order was cancelled
  - `cancelled_by` (text, nullable) — admin identifier (email or name) who cancelled
  - `previous_status` (text, nullable) — status before cancellation
  - `original_order_id` (uuid, nullable) — for reorders: references the original cancelled order
  - `reorder_count` (integer, default 0) — how many times this order has been reordered

  ### Notes
  - All new columns are nullable/have defaults to avoid breaking existing rows
  - original_order_id has no FK constraint to avoid circular dependency issues
  - RLS: existing "Admin can update orders" policy already covers these new columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'cancel_reason'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN cancel_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN cancelled_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'cancelled_by'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN cancelled_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'previous_status'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN previous_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'original_order_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN original_order_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'reorder_count'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN reorder_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;
