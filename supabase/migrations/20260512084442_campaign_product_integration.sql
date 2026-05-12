/*
  # Campaign-Product Integration

  ## Overview
  Adds the campaign-product linking layer, campaign discounts, and
  auto-activation/expiration support. All new tables use is_admin_request() RLS.

  ## New Tables

  ### campaign_products
  Links products (and optionally categories/brands) to a saved_campaign.
  - campaign_id → saved_campaigns.id
  - product_id → products.id (nullable: allow category-level links)
  - category_slug (text) — optional category filter
  - is_featured (boolean) — highlight on storefront
  - sort_order (int)

  ### campaign_discounts
  Stores discount rules for a campaign. When the campaign is active the
  discount_value / coupon_code can be surfaced on the storefront.
  - campaign_id → saved_campaigns.id
  - discount_type: 'percentage' | 'fixed'
  - discount_value (numeric)
  - coupon_code (text, unique-ish)
  - min_order_amount (numeric)
  - max_uses (int, nullable)
  - usage_count (int, default 0)
  - is_active (boolean)

  ## Modified Tables
  ### saved_campaigns
  Adds start_date / end_date / auto_activate columns so the front-end
  can detect and flip campaigns active/expired.

  ## Security
  All tables: RLS enabled, admin-only (authenticated + anon both checked via is_admin_request()).
  campaign_discounts also gets a public read policy (storefront needs coupon data).
*/

-- ── saved_campaigns: add date + auto-activate columns ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_campaigns' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE saved_campaigns ADD COLUMN start_date date;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_campaigns' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE saved_campaigns ADD COLUMN end_date date;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_campaigns' AND column_name = 'auto_activate'
  ) THEN
    ALTER TABLE saved_campaigns ADD COLUMN auto_activate boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'saved_campaigns' AND column_name = 'offer_badge'
  ) THEN
    ALTER TABLE saved_campaigns ADD COLUMN offer_badge text NOT NULL DEFAULT '';
  END IF;
END $$;

-- ── campaign_products ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL REFERENCES saved_campaigns(id) ON DELETE CASCADE,
  product_id    uuid,
  category_slug text NOT NULL DEFAULT '',
  is_featured   boolean NOT NULL DEFAULT false,
  sort_order    integer NOT NULL DEFAULT 0,
  admin_email   text NOT NULL DEFAULT '',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_products_campaign_id_idx ON campaign_products (campaign_id);
CREATE INDEX IF NOT EXISTS campaign_products_product_id_idx  ON campaign_products (product_id);

ALTER TABLE campaign_products ENABLE ROW LEVEL SECURITY;

-- Admin write + read
CREATE POLICY "Admin select campaign_products"
  ON campaign_products FOR SELECT TO authenticated USING (is_admin_request());
CREATE POLICY "Admin insert campaign_products"
  ON campaign_products FOR INSERT TO authenticated WITH CHECK (is_admin_request());
CREATE POLICY "Admin update campaign_products"
  ON campaign_products FOR UPDATE TO authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());
CREATE POLICY "Admin delete campaign_products"
  ON campaign_products FOR DELETE TO authenticated USING (is_admin_request());

CREATE POLICY "Anon select campaign_products"
  ON campaign_products FOR SELECT TO anon USING (is_admin_request());
CREATE POLICY "Anon insert campaign_products"
  ON campaign_products FOR INSERT TO anon WITH CHECK (is_admin_request());
CREATE POLICY "Anon update campaign_products"
  ON campaign_products FOR UPDATE TO anon
  USING (is_admin_request()) WITH CHECK (is_admin_request());
CREATE POLICY "Anon delete campaign_products"
  ON campaign_products FOR DELETE TO anon USING (is_admin_request());

-- Public read so storefront can fetch linked products for active campaigns
CREATE POLICY "Public read campaign_products"
  ON campaign_products FOR SELECT TO anon USING (true);

-- ── campaign_discounts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_discounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      uuid NOT NULL REFERENCES saved_campaigns(id) ON DELETE CASCADE,
  discount_type    text NOT NULL DEFAULT 'percentage'
                     CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value   numeric NOT NULL DEFAULT 0,
  coupon_code      text NOT NULL DEFAULT '',
  min_order_amount numeric NOT NULL DEFAULT 0,
  max_uses         integer,
  usage_count      integer NOT NULL DEFAULT 0,
  is_active        boolean NOT NULL DEFAULT true,
  admin_email      text NOT NULL DEFAULT '',
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_discounts_campaign_id_idx ON campaign_discounts (campaign_id);
CREATE INDEX IF NOT EXISTS campaign_discounts_coupon_code_idx  ON campaign_discounts (coupon_code);

ALTER TABLE campaign_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select campaign_discounts"
  ON campaign_discounts FOR SELECT TO authenticated USING (is_admin_request());
CREATE POLICY "Admin insert campaign_discounts"
  ON campaign_discounts FOR INSERT TO authenticated WITH CHECK (is_admin_request());
CREATE POLICY "Admin update campaign_discounts"
  ON campaign_discounts FOR UPDATE TO authenticated
  USING (is_admin_request()) WITH CHECK (is_admin_request());
CREATE POLICY "Admin delete campaign_discounts"
  ON campaign_discounts FOR DELETE TO authenticated USING (is_admin_request());

CREATE POLICY "Anon select campaign_discounts"
  ON campaign_discounts FOR SELECT TO anon USING (is_admin_request());
CREATE POLICY "Anon insert campaign_discounts"
  ON campaign_discounts FOR INSERT TO anon WITH CHECK (is_admin_request());
CREATE POLICY "Anon update campaign_discounts"
  ON campaign_discounts FOR UPDATE TO anon
  USING (is_admin_request()) WITH CHECK (is_admin_request());

-- Public read: storefront needs to display active discount codes
CREATE POLICY "Public read campaign_discounts"
  ON campaign_discounts FOR SELECT TO anon USING (is_active = true);
