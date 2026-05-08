/*
  # Harden RLS: Replace all always-true write policies with admin-only checks

  This migration fixes 46+ RLS policies across 18 tables that currently allow
  unrestricted write access (INSERT/UPDATE/DELETE with USING(true) or
  WITH CHECK(true)).

  ## Strategy
  All admin-managed tables now require `is_admin_request()` for write operations.
  This function verifies the `x-admin-token` header against bcrypt hashes in the
  `employees` table, ensuring only authenticated admin sessions can modify data.

  ## Tables updated (admin-only writes via is_admin_request)
  - `categories` (INSERT, UPDATE, DELETE)
  - `category_translations` (INSERT, UPDATE, DELETE)
  - `cms_content` (INSERT, UPDATE, DELETE)
  - `employees` (SELECT, INSERT, UPDATE, DELETE)
  - `homepage_content` (INSERT, UPDATE, DELETE)
  - `layout_settings` (INSERT, UPDATE, DELETE)
  - `page_blocks` (INSERT, UPDATE, DELETE)
  - `page_layouts` (INSERT, UPDATE, DELETE)
  - `product_images` (INSERT, UPDATE, DELETE)
  - `product_shades` (INSERT, UPDATE, DELETE)
  - `product_translations` (INSERT, UPDATE, DELETE)
  - `products` (INSERT, UPDATE, DELETE)
  - `site_branding` (INSERT, UPDATE, DELETE)
  - `site_settings` (INSERT, UPDATE, DELETE)
  - `theme_settings` (INSERT, UPDATE, DELETE)
  - `ui_size_settings` (INSERT, UPDATE)

  ## Tables updated (guest insert with validation, admin update/delete)
  - `orders` (INSERT: validated guest checkout, no UPDATE/DELETE change)
  - `order_items` (INSERT: validated guest checkout, no UPDATE/DELETE change)

  ## Important notes
  1. All existing SELECT (read) policies are preserved unchanged
  2. The `is_admin_request()` function was created in previous migration
  3. Orders retain anon INSERT for guest checkout with field validation
  4. No data is modified or deleted
*/

-- ============================================================================
-- 1. CATEGORIES
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated can manage categories" ON categories;
DROP POLICY IF EXISTS "Authenticated can update categories" ON categories;
DROP POLICY IF EXISTS "Authenticated can delete categories" ON categories;

CREATE POLICY "Admins can insert categories"
  ON categories FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 2. CATEGORY_TRANSLATIONS
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated can manage category_translations" ON category_translations;
DROP POLICY IF EXISTS "Authenticated can update category_translations" ON category_translations;
DROP POLICY IF EXISTS "Authenticated can delete category_translations" ON category_translations;

CREATE POLICY "Admins can insert category_translations"
  ON category_translations FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update category_translations"
  ON category_translations FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete category_translations"
  ON category_translations FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 3. CMS_CONTENT
-- ============================================================================
DROP POLICY IF EXISTS "Anon and auth can insert cms_content" ON cms_content;
DROP POLICY IF EXISTS "Anon and auth can update cms_content" ON cms_content;
DROP POLICY IF EXISTS "Anon and auth can delete cms_content" ON cms_content;

CREATE POLICY "Admins can insert cms_content"
  ON cms_content FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update cms_content"
  ON cms_content FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete cms_content"
  ON cms_content FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 4. EMPLOYEES
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read employees" ON employees;
DROP POLICY IF EXISTS "Anyone can insert employees" ON employees;
DROP POLICY IF EXISTS "Anyone can update employees" ON employees;
DROP POLICY IF EXISTS "Anyone can delete employees" ON employees;
DROP POLICY IF EXISTS "Admin can read employees" ON employees;

CREATE POLICY "Admins can read employees"
  ON employees FOR SELECT
  TO anon, authenticated
  USING (is_admin_request());

CREATE POLICY "Admins can insert employees"
  ON employees FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update employees"
  ON employees FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete employees"
  ON employees FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 5. HOMEPAGE_CONTENT
-- ============================================================================
DROP POLICY IF EXISTS "Anon and auth can insert homepage content" ON homepage_content;
DROP POLICY IF EXISTS "Anon and auth can update homepage content" ON homepage_content;
DROP POLICY IF EXISTS "Anon and auth can delete homepage content" ON homepage_content;

CREATE POLICY "Admins can insert homepage_content"
  ON homepage_content FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update homepage_content"
  ON homepage_content FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete homepage_content"
  ON homepage_content FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 6. LAYOUT_SETTINGS
-- ============================================================================
DROP POLICY IF EXISTS "Anon and auth can insert layout settings" ON layout_settings;
DROP POLICY IF EXISTS "Anon and auth can update layout settings" ON layout_settings;
DROP POLICY IF EXISTS "Anon and auth can delete layout settings" ON layout_settings;

CREATE POLICY "Admins can insert layout_settings"
  ON layout_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update layout_settings"
  ON layout_settings FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete layout_settings"
  ON layout_settings FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 7. PAGE_BLOCKS
-- ============================================================================
DROP POLICY IF EXISTS "Anon and auth can insert page blocks" ON page_blocks;
DROP POLICY IF EXISTS "Anon and auth can update page blocks" ON page_blocks;
DROP POLICY IF EXISTS "Anon and auth can delete page blocks" ON page_blocks;

CREATE POLICY "Admins can insert page_blocks"
  ON page_blocks FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update page_blocks"
  ON page_blocks FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete page_blocks"
  ON page_blocks FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 8. PAGE_LAYOUTS
-- ============================================================================
DROP POLICY IF EXISTS "Anon and auth can insert page layouts" ON page_layouts;
DROP POLICY IF EXISTS "Anon and auth can update page layouts" ON page_layouts;
DROP POLICY IF EXISTS "Anon and auth can delete page layouts" ON page_layouts;

CREATE POLICY "Admins can insert page_layouts"
  ON page_layouts FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update page_layouts"
  ON page_layouts FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete page_layouts"
  ON page_layouts FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 9. PRODUCT_IMAGES
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can insert product images" ON product_images;
DROP POLICY IF EXISTS "Anyone can update product images" ON product_images;
DROP POLICY IF EXISTS "Anyone can delete product images" ON product_images;

CREATE POLICY "Admins can insert product_images"
  ON product_images FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update product_images"
  ON product_images FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete product_images"
  ON product_images FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 10. PRODUCT_SHADES
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can insert product shades" ON product_shades;
DROP POLICY IF EXISTS "Anyone can update product shades" ON product_shades;
DROP POLICY IF EXISTS "Anyone can delete product shades" ON product_shades;

CREATE POLICY "Admins can insert product_shades"
  ON product_shades FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update product_shades"
  ON product_shades FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete product_shades"
  ON product_shades FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 11. PRODUCT_TRANSLATIONS
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated can manage product_translations" ON product_translations;
DROP POLICY IF EXISTS "Authenticated can update product_translations" ON product_translations;
DROP POLICY IF EXISTS "Authenticated can delete product_translations" ON product_translations;

CREATE POLICY "Admins can insert product_translations"
  ON product_translations FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update product_translations"
  ON product_translations FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete product_translations"
  ON product_translations FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 12. PRODUCTS
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can insert products" ON products;
DROP POLICY IF EXISTS "Anyone can update products" ON products;
DROP POLICY IF EXISTS "Anyone can delete products" ON products;

CREATE POLICY "Admins can insert products"
  ON products FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update products"
  ON products FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete products"
  ON products FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 13. SITE_BRANDING
-- ============================================================================
DROP POLICY IF EXISTS "Anon and auth can insert branding" ON site_branding;
DROP POLICY IF EXISTS "Anon and auth can update branding" ON site_branding;
DROP POLICY IF EXISTS "Anon and auth can delete branding" ON site_branding;

CREATE POLICY "Admins can insert site_branding"
  ON site_branding FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update site_branding"
  ON site_branding FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete site_branding"
  ON site_branding FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 14. SITE_SETTINGS
-- ============================================================================
DROP POLICY IF EXISTS "Anon and auth can insert site settings" ON site_settings;
DROP POLICY IF EXISTS "Anon and auth can update site settings" ON site_settings;
DROP POLICY IF EXISTS "Anon and auth can delete site settings" ON site_settings;

CREATE POLICY "Admins can insert site_settings"
  ON site_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update site_settings"
  ON site_settings FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete site_settings"
  ON site_settings FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 15. THEME_SETTINGS
-- ============================================================================
DROP POLICY IF EXISTS "Anon and auth can insert theme settings" ON theme_settings;
DROP POLICY IF EXISTS "Anon and auth can update theme settings" ON theme_settings;
DROP POLICY IF EXISTS "Anon and auth can delete theme settings" ON theme_settings;

CREATE POLICY "Admins can insert theme_settings"
  ON theme_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update theme_settings"
  ON theme_settings FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can delete theme_settings"
  ON theme_settings FOR DELETE
  TO anon, authenticated
  USING (is_admin_request());

-- ============================================================================
-- 16. UI_SIZE_SETTINGS
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can insert ui size settings" ON ui_size_settings;
DROP POLICY IF EXISTS "Anyone can update ui size settings" ON ui_size_settings;

CREATE POLICY "Admins can insert ui_size_settings"
  ON ui_size_settings FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_admin_request());

CREATE POLICY "Admins can update ui_size_settings"
  ON ui_size_settings FOR UPDATE
  TO anon, authenticated
  USING (is_admin_request())
  WITH CHECK (is_admin_request());

-- ============================================================================
-- 17. ORDERS (guest checkout INSERT with validation)
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can insert orders" ON orders;

CREATE POLICY "Guest can insert orders with valid data"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'confirmed'
    AND customer_email IS NOT NULL
    AND customer_email <> ''
    AND total >= 0
  );

-- ============================================================================
-- 18. ORDER_ITEMS (guest checkout INSERT with validation)
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can insert order items" ON order_items;

CREATE POLICY "Guest can insert order items with valid data"
  ON order_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    order_id IS NOT NULL
    AND product_id IS NOT NULL
    AND quantity > 0
    AND unit_price >= 0
  );
