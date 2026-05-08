/*
  # Seed default Lazurde dark-pink theme

  Inserts one row into theme_settings with the current Lazurde brand colours
  as the default theme. Uses INSERT ... ON CONFLICT DO NOTHING so it only
  runs if the table is empty.
*/

INSERT INTO theme_settings (
  id,
  primary_color,
  secondary_color,
  accent_color,
  button_color,
  button_text_color,
  background_color,
  card_background_color,
  border_color,
  glow_color,
  text_primary_color,
  text_secondary_color,
  warning_color,
  success_color,
  active_preset,
  updated_at
)
SELECT
  gen_random_uuid(),
  '#FF4D8D',
  '#CC3066',
  '#FF4D8D',
  '#FF4D8D',
  '#0A0507',
  '#0A0507',
  '#1E0F18',
  'rgba(255,77,141,0.3)',
  'rgba(255,77,141,0.15)',
  '#FDE8F0',
  '#D67EB0',
  '#FFB300',
  '#00E676',
  'lazurde_dark',
  now()
WHERE NOT EXISTS (SELECT 1 FROM theme_settings);
