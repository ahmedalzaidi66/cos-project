/*
  # Omit all public tables from the GraphQL schema

  ## Problem
  pg_graphql exposes every table the `anon` role can SELECT as a queryable
  GraphQL type. The introspection endpoint at /graphql/v1 is public, so
  unauthenticated callers can enumerate all table names, columns, and
  relationships — a schema-leak security issue.

  ## Fix
  Apply the pg_graphql `@omit` comment directive to every affected table.
  `COMMENT ON TABLE ... '@omit'` instructs pg_graphql to exclude the type
  from the GraphQL schema entirely, including introspection responses.

  The application exclusively uses the PostgREST REST API, never GraphQL,
  so hiding these types from the GraphQL layer has no effect on the app.

  ## Tables omitted from GraphQL
  categories, category_translations, cms_content, coupons, employees,
  hero_offers, homepage_content, layout_settings, order_items, orders,
  page_blocks, page_layouts, product_images, product_shades,
  product_translations, products, reviews, site_branding, site_settings,
  theme_settings, ui_size_settings, user_product_interactions, user_skin_profiles
*/

comment on table public.categories                is '@omit';
comment on table public.category_translations     is '@omit';
comment on table public.cms_content               is '@omit';
comment on table public.coupons                   is '@omit';
comment on table public.employees                 is '@omit';
comment on table public.hero_offers               is '@omit';
comment on table public.homepage_content          is '@omit';
comment on table public.layout_settings           is '@omit';
comment on table public.order_items               is '@omit';
comment on table public.orders                    is '@omit';
comment on table public.page_blocks               is '@omit';
comment on table public.page_layouts              is '@omit';
comment on table public.product_images            is '@omit';
comment on table public.product_shades            is '@omit';
comment on table public.product_translations      is '@omit';
comment on table public.products                  is '@omit';
comment on table public.reviews                   is '@omit';
comment on table public.site_branding             is '@omit';
comment on table public.site_settings             is '@omit';
comment on table public.theme_settings            is '@omit';
comment on table public.ui_size_settings          is '@omit';
comment on table public.user_product_interactions is '@omit';
comment on table public.user_skin_profiles        is '@omit';
