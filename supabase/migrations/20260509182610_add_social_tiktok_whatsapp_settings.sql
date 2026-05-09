/*
  # Add TikTok and WhatsApp settings keys

  Inserts default empty rows for social_tiktok and social_whatsapp into
  site_settings so they can be edited from the admin Settings page and
  read by the customer-facing AccountFooter.
*/

INSERT INTO site_settings (key, value)
VALUES
  ('social_tiktok',   ''),
  ('social_whatsapp', '')
ON CONFLICT (key) DO NOTHING;
