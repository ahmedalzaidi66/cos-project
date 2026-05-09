/*
  # Add customer_app_theme setting

  1. Changes
    - Inserts default 'customer_app_theme' key into site_settings with value 'dark'
    - Admins can set this to 'dark' or 'light' to control customer-facing UI theme

  2. Notes
    - Uses INSERT ... ON CONFLICT DO NOTHING so existing values are preserved
    - site_settings already has RLS configured allowing public reads
*/

INSERT INTO site_settings (key, value)
VALUES ('customer_app_theme', 'dark')
ON CONFLICT (key) DO NOTHING;
