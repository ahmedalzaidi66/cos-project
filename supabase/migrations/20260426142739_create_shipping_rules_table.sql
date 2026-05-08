/*
  # Create shipping_rules table

  ## Purpose
  Stores region-based shipping fee rules that the checkout uses to calculate
  shipping cost. Admins manage these rules from the Admin → Shipping page.

  ## New Table: shipping_rules
  - id (uuid, primary key)
  - country (text) — e.g. "Iraq"
  - governorate (text) — e.g. "Baghdad"
  - area (text) — e.g. "Karrada". Can be empty to mean "all areas in governorate"
  - shipping_fee (numeric 10,2) — fee in IQD
  - free_shipping_minimum (numeric 10,2) — subtotal threshold for free shipping (0 = never free)
  - is_active (boolean, default true)
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ## Security
  - RLS enabled
  - anon can SELECT active rules (needed for checkout rule lookup)
  - Admins (service role) can do full CRUD via admin client
*/

CREATE TABLE IF NOT EXISTS public.shipping_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country               text NOT NULL DEFAULT '',
  governorate           text NOT NULL DEFAULT '',
  area                  text NOT NULL DEFAULT '',
  shipping_fee          numeric(10, 2) NOT NULL DEFAULT 0,
  free_shipping_minimum numeric(10, 2) NOT NULL DEFAULT 0,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_rules ENABLE ROW LEVEL SECURITY;

-- anon and authenticated users can read active rules (needed during checkout)
CREATE POLICY "Anyone can view active shipping rules"
  ON public.shipping_rules
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Only service role (admin operations) may insert / update / delete
CREATE POLICY "Service role can insert shipping rules"
  ON public.shipping_rules
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update shipping rules"
  ON public.shipping_rules
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete shipping rules"
  ON public.shipping_rules
  FOR DELETE
  TO service_role
  USING (true);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_shipping_rules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipping_rules_updated_at ON public.shipping_rules;
CREATE TRIGGER trg_shipping_rules_updated_at
  BEFORE UPDATE ON public.shipping_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_shipping_rules_updated_at();
