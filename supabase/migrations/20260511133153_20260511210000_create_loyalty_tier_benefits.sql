/*
  # Loyalty Tier Benefits

  ## Summary
  Adds a `loyalty_tier_benefits` table so admins can configure per-tier perks:
  discount percentage, free shipping, bonus multiplier, birthday bonus, exclusive
  offers, early access, and a custom description. Bronze is included for completeness
  but defaults to no perks.

  ## Tables
  - `loyalty_tier_benefits` — one row per tier (bronze/silver/gold/platinum)
    - `tier` (PK text)
    - `min_points` — minimum lifetime points to reach this tier
    - `discount_pct` — fixed cart discount percentage (0 = disabled)
    - `free_shipping` — boolean
    - `bonus_multiplier` — points earn multiplier (1.0 = normal)
    - `birthday_bonus` — extra points awarded on birthday
    - `exclusive_offers` — boolean
    - `early_access` — boolean
    - `description` — short display text for customer-facing UI

  ## Security
  - Public/authenticated SELECT (customers need to see their benefits)
  - Service role full CRUD (admin edits go through adminSupabase)

  ## Seed
  - Bronze: baseline, no perks
  - Silver: 10% discount, 1.2x multiplier
  - Gold:   15% discount, 1.5x multiplier, exclusive offers
  - Platinum: 20% discount, free shipping, 2x multiplier, exclusive offers, early access
*/

CREATE TABLE IF NOT EXISTS loyalty_tier_benefits (
  tier              text PRIMARY KEY CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  min_points        integer NOT NULL DEFAULT 0 CHECK (min_points >= 0),
  discount_pct      numeric NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  free_shipping     boolean NOT NULL DEFAULT false,
  bonus_multiplier  numeric NOT NULL DEFAULT 1.0 CHECK (bonus_multiplier > 0),
  birthday_bonus    integer NOT NULL DEFAULT 0 CHECK (birthday_bonus >= 0),
  exclusive_offers  boolean NOT NULL DEFAULT false,
  early_access      boolean NOT NULL DEFAULT false,
  description       text NOT NULL DEFAULT '',
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE loyalty_tier_benefits ENABLE ROW LEVEL SECURITY;

-- Authenticated users (and anon) can read tier benefits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'loyalty_tier_benefits' AND policyname = 'Anyone can read tier benefits'
  ) THEN
    CREATE POLICY "Anyone can read tier benefits"
      ON loyalty_tier_benefits FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- Service role can manage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'loyalty_tier_benefits' AND policyname = 'Service role manages tier benefits'
  ) THEN
    CREATE POLICY "Service role manages tier benefits"
      ON loyalty_tier_benefits FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Seed default values
INSERT INTO loyalty_tier_benefits (tier, min_points, discount_pct, free_shipping, bonus_multiplier, birthday_bonus, exclusive_offers, early_access, description)
VALUES
  ('bronze',   0,     0,  false, 1.0, 0,   false, false, 'Welcome to Lazurde Rewards. Earn points on every purchase.'),
  ('silver',   2000,  10, false, 1.2, 100, false, false, '10% discount on all orders. 1.2x bonus points on every purchase.'),
  ('gold',     5000,  15, false, 1.5, 250, true,  false, '15% discount + 1.5x bonus points. Access to exclusive member offers.'),
  ('platinum', 15000, 20, true,  2.0, 500, true,  true,  'Free shipping + 20% discount + 2x bonus points. Early access to new launches.')
ON CONFLICT (tier) DO NOTHING;
