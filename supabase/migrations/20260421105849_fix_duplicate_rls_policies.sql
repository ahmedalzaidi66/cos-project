/*
  # Fix duplicate and overly-permissive RLS policies

  1. Removes duplicate SELECT policies on categories, category_translations, and homepage_content
  2. Removes the "categories_public_read" policy that uses USING (true) (allows inactive categories)
  3. Keeps the correct "Public can read categories" policy that filters active=true
  4. Removes the "cat_trans_public_read" duplicate on category_translations
  5. Removes the "Anyone can read homepage content" duplicate on homepage_content
*/

-- categories: remove duplicates
DROP POLICY IF EXISTS "categories_public_read" ON categories;

-- category_translations: remove duplicate
DROP POLICY IF EXISTS "cat_trans_public_read" ON category_translations;

-- homepage_content: remove duplicate
DROP POLICY IF EXISTS "Anyone can read homepage content" ON homepage_content;
