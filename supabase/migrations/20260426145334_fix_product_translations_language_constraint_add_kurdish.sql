/*
  # Fix product_translations language constraint to include Kurdish and Russian

  ## Changes
  - Drops the existing `product_translations_language_check` constraint which only allowed: en, ar, es, de
  - Recreates it to allow: en, ar, es, de, ru, ku

  ## Notes
  - No existing rows are broken: ru/ku rows either don't exist yet or will now be accepted
  - The unique constraint (product_id, language) is untouched
*/

ALTER TABLE public.product_translations
  DROP CONSTRAINT IF EXISTS product_translations_language_check;

ALTER TABLE public.product_translations
  ADD CONSTRAINT product_translations_language_check
  CHECK (language IN ('en', 'ar', 'es', 'de', 'ru', 'ku'));
