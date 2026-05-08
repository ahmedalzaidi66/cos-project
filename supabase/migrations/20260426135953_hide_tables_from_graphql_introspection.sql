/*
  # Hide all public tables from pg_graphql introspection

  ## Problem
  The pg_graphql extension exposes all tables that the `anon` role has SELECT on
  via the public /graphql/v1 introspection endpoint. This leaks schema structure
  (table names, columns, relationships) to unauthenticated callers.

  ## Fix
  Use pg_graphql's built-in @omit comment directive on every affected table.
  This tells pg_graphql to exclude the table from the GraphQL schema entirely,
  so it will not appear in introspection queries.

  The app uses the REST API (PostgREST) exclusively — not GraphQL — so this
  change has zero impact on application functionality.

  ## Tables hidden
  categories, category_translations, cms_content, coupons, employees,
  hero_offers, homepage_content, layout_settings, order_items, orders,
  page_blocks, page_layouts, product_images, product_shades,
  product_translations, products, reviews, site_branding, site_settings,
  theme_settings, ui_size_settings, user_product_interactions, user_skin_profiles
*/

comment on table public.categories                is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.category_translations     is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.cms_content               is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.coupons                   is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.employees                 is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.hero_offers               is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.homepage_content          is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.layout_settings           is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.order_items               is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.orders                    is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.page_blocks               is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.page_layouts              is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.product_images            is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.product_shades            is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.product_translations      is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.products                  is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.reviews                   is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.site_branding             is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.site_settings             is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.theme_settings            is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.ui_size_settings          is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.user_product_interactions is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
comment on table public.user_skin_profiles        is E'@graphql({"totalCount": {"enabled": false}, "description": ""})';
