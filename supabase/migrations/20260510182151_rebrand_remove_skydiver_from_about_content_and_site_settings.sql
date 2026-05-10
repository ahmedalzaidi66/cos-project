/*
  # Rebrand: Remove all Skydiver/old-placeholder branding from live data

  ## Summary
  The `about_content` table still contains legacy "Skydiver Man Gear" data seeded
  by the initial migration. The `site_settings` table has a typo in store_tagline
  and an old skydiving-era placeholder address. This migration overwrites all
  remaining old-brand content with correct Lazurde Beauty copy.

  ## Changes

  ### about_content
  - brand.name: "SKYDIVER MAN GEAR" → "LAZURDE BEAUTY"
  - brand.tagline: "Professional gear trusted by skydivers worldwide" → "Premium makeup loved by beauty enthusiasts worldwide"
  - brand.description: skydiving text → Lazurde beauty description
  - brand.mission: skydiving text → Lazurde mission statement
  - contact.email: "support@skydivermagear.com" → "support@lazurdebeauty.com"
  - footer.copyright: "© 2026 Skydiver Man Gear..." → "© 2026 Lazurde Beauty..."
  - social.facebook_handle: "Skydiver Man Gear" → "Lazurde Beauty"
  - social.instagram_handle: "@skydivermanGear" → "@lazurdebeauty"
  - social.tiktok_handle: "@skydivermanGear" → "@lazurdebeauty"

  ### site_settings
  - store_tagline: "Professional lazurude item" (typo) → "Premium Makeup & Beauty"
  - contact_address: "123 Freefall Ave, Sky City, CA 90210" → "" (cleared — no real address)

  ## Security
  No RLS changes. Uses direct UPDATE statements safe for migration context.
*/

-- ── about_content: overwrite all stale Skydiver branding ─────────────────────

UPDATE about_content
SET value = 'LAZURDE BEAUTY'
WHERE section = 'brand' AND key = 'name' AND language = 'en';

UPDATE about_content
SET value = 'Premium makeup loved by beauty enthusiasts worldwide'
WHERE section = 'brand' AND key = 'tagline' AND language = 'en';

UPDATE about_content
SET value = 'Lazurde Beauty is a premium cosmetics brand dedicated to celebrating every skin tone. Our curated collection of makeup — from richly pigmented lipsticks to long-wear foundations — is crafted with high-quality ingredients trusted by beauty lovers worldwide.'
WHERE section = 'brand' AND key = 'description' AND language = 'en';

UPDATE about_content
SET value = 'To make premium beauty accessible to everyone — delivering products that celebrate individuality and inspire confidence at every step of your routine.'
WHERE section = 'brand' AND key = 'mission' AND language = 'en';

UPDATE about_content
SET value = 'support@lazurdebeauty.com'
WHERE section = 'contact' AND key = 'email' AND language = 'en';

UPDATE about_content
SET value = '© 2026 Lazurde Beauty. All rights reserved.'
WHERE section = 'footer' AND key = 'copyright' AND language = 'en';

UPDATE about_content
SET value = 'Lazurde Beauty'
WHERE section = 'social' AND key = 'facebook_handle' AND language = 'en';

UPDATE about_content
SET value = '@lazurdebeauty'
WHERE section = 'social' AND key = 'instagram_handle' AND language = 'en';

UPDATE about_content
SET value = '@lazurdebeauty'
WHERE section = 'social' AND key = 'tiktok_handle' AND language = 'en';

-- ── site_settings: fix typo and remove old placeholder address ───────────────

UPDATE site_settings
SET value = 'Premium Makeup & Beauty'
WHERE key = 'store_tagline';

UPDATE site_settings
SET value = ''
WHERE key = 'contact_address';

-- ── site_settings: fix contact_email value (was domain-only, not a valid email) ─

UPDATE site_settings
SET value = 'support@lazurdebeauty.com'
WHERE key = 'contact_email' AND (value = 'Lazurdebeauty.com' OR value ILIKE '%.com' AND value NOT LIKE '%@%');
