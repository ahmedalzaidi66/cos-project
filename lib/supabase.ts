import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.supabaseUrl;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.supabaseAnonKey;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Admin session token ──────────────────────────────────────────────────────
// Stored after a successful admin login. Sent as x-admin-token on every request
// made through adminSupabase(). is_admin_request() in Postgres reads this header
// and verifies it against the bcrypt hash stored on the employee row — this works
// across separate HTTP requests, unlike the old transaction-local set_config approach.

let _adminSessionToken: string | null = null;

export function setAdminSessionToken(token: string | null) {
  _adminSessionToken = token;
}

export function getAdminToken(): string | null {
  return _adminSessionToken;
}

/**
 * Returns a Supabase client that injects x-admin-token on every request.
 * Use this instead of bare `supabase` for all admin INSERT/UPDATE/DELETE operations.
 * Throws if called without an active admin session so callers surface the error clearly.
 */
export function adminSupabase() {
  if (!_adminSessionToken) {
    // Return anon client — admin writes will be rejected by RLS (is_admin_request() = false)
    // Callers should check for errors and handle accordingly
    return supabase;
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { 'x-admin-token': _adminSessionToken },
    },
  });
}

export function hasAdminSession(): boolean {
  return _adminSessionToken !== null;
}

/** @deprecated — no longer needed. The token is sent automatically via adminSupabase(). */
export async function activateAdminSession(): Promise<boolean> {
  return _adminSessionToken !== null;
}

// ─── Core Product Types ───────────────────────────────────────────────────────

export type Product = {
  id: string;
  name: string;
  slug: string | null;
  price: number;
  compare_price: number | null;
  category: string;
  category_id: string | null;
  rating: number;
  review_count: number;
  description: string;
  image_url: string;
  main_image: string | null;
  images: string[];
  stock: number;
  in_stock: boolean;
  badge: string | null;
  is_featured: boolean;
  featured: boolean | null;
  status: 'active' | 'draft' | 'archived' | null;
  sku: string | null;
  specifications: Record<string, any> | null;
  try_on_type: string | null;
  makeup_subcategory: 'lips' | 'face' | 'eye' | 'nail' | null;
  // Loyalty / bonus
  bonus_enabled: boolean;
  bonus_points: number;
  bonus_percentage: number | null;
  // Legacy translation columns (kept for backwards compat)
  name_ar: string | null;
  name_es: string | null;
  name_de: string | null;
  description_ar: string | null;
  description_es: string | null;
  description_de: string | null;
  created_at: string;
  updated_at: string | null;
  // Joined translation (populated when queried with language)
  translation?: ProductTranslation | null;
};

export type ProductTranslation = {
  id: string;
  product_id: string;
  language: string;
  name: string;
  short_description: string;
  full_description: string;
  meta_title: string;
  meta_description: string;
};

export type Category = {
  id: string;
  slug: string;
  image: string;
  icon_url: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  translation?: CategoryTranslation | null;
};

export type CategoryTranslation = {
  id: string;
  category_id: string;
  language: string;
  name: string;
  description: string;
};

export type CMSContent = {
  id: string;
  language: string;
  logo: string;
  hero_title: string;
  hero_subtitle: string;
  hero_button_text: string;
  hero_image: string;
  featured_title: string;
  canopy_title: string;
  canopy_description: string;
  testimonial_title: string;
  footer_text: string;
  updated_at: string;
};

export type ThemeSettings = {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  button_color: string;
  button_text_color: string;
  background_color: string;
  card_background_color: string;
  border_color: string;
  glow_color: string;
  text_primary_color: string;
  text_secondary_color: string;
  warning_color: string;
  success_color: string;
  active_preset: string;
};

// ─── Legacy Types (kept for admin pages) ─────────────────────────────────────

export type Order = {
  id: string;
  user_id?: string | null;
  customer_email: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  governorate?: string;
  area?: string;
  notes?: string | null;
  admin_notes?: string | null;
  payment_method: string;
  payment_status?: string;
  subtotal: number;
  shipping: number;
  total: number;
  status: string;
  created_at: string;
  updated_at?: string;
  tracking_number?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;
  previous_status?: string | null;
  original_order_id?: string | null;
  reorder_count?: number;
  points_earned?: number;
  points_redeemed?: number;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_image: string;
  quantity: number;
  unit_price: number;
  shade_name?: string;
  shade_hex?: string;
  shade_image?: string;
  shade_product_image?: string;
  created_at: string;
};

export type Employee = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  avatar_url: string | null;
  join_date: string | null;
  auth_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SiteSetting = {
  id: string;
  key: string;
  value: string;
  updated_at: string;
};

export type HomepageContent = {
  id: string;
  section: string;
  key: string;
  value: string;
  updated_at: string;
};

export type Review = {
  id: string;
  product_id: string | null;
  customer_name: string;
  customer_email: string;
  rating: number;
  body: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

export type Coupon = {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value: number;
  expiry_date: string | null;
  is_active: boolean;
  usage_count: number;
  max_uses: number | null;
  created_at: string;
  updated_at: string;
};

// ─── Data Helpers ─────────────────────────────────────────────────────────────

export function getProductName(product: Product, language: string): string {
  if (product.translation?.name) return product.translation.name;
  if (language === 'ar'  && product.name_ar) return product.name_ar;
  if (language === 'es'  && product.name_es) return product.name_es;
  if (language === 'de'  && product.name_de) return product.name_de;
  if (language === 'ckb' && product.name_ar) return product.name_ar;
  return product.name;
}

export function getProductDescription(product: Product, language: string): string {
  if (product.translation?.full_description) return product.translation.full_description;
  if (product.translation?.short_description) return product.translation.short_description;
  if (language === 'ar'  && product.description_ar) return product.description_ar;
  if (language === 'es'  && product.description_es) return product.description_es;
  if (language === 'de'  && product.description_de) return product.description_de;
  if (language === 'ckb' && product.description_ar) return product.description_ar;
  return product.description;
}

export function getProductShortDescription(product: Product, language: string): string {
  if (product.translation?.short_description) return product.translation.short_description;
  return getProductDescription(product, language).slice(0, 120);
}

export function getProductImage(product: Product): string {
  return product.main_image || product.image_url || '';
}

export function getProductImages(product: Product): string[] {
  if (product.images && product.images.length > 0) return product.images;
  const img = getProductImage(product);
  return img ? [img] : [];
}

export async function fetchProductGallery(productId: string): Promise<string[]> {
  const { data } = await supabase
    .from('product_images')
    .select('url, is_main, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });
  if (data && data.length > 0) {
    return data.map((row: { url: string }) => row.url);
  }
  return [];
}

export type ProductShade = {
  id: string;
  name: string;
  color_hex: string;
  shade_image: string;
  product_image: string;
  sort_order: number;
  is_available: boolean;
};

export async function fetchProductShades(productId: string): Promise<ProductShade[]> {
  const cached = cacheGet(_shadesCache, productId);
  if (cached) return cached;

  const { data } = await supabase
    .from('product_shades')
    .select('id, name, color_hex, shade_image, product_image, sort_order, is_available')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });
  const result = (data ?? []) as ProductShade[];
  cacheSet(_shadesCache, productId, result);
  return result;
}

function slugToLabel(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getCategoryName(category: Category, language: string): string {
  if (category.translation?.name) return category.translation.name;
  return slugToLabel(category.slug);
}

export function getCategoryDescription(category: Category, language: string): string {
  return category.translation?.description ?? '';
}

// ─── Session cache ────────────────────────────────────────────────────────────
// Lightweight in-memory cache that lives for the duration of the browser session.
// Avoids redundant round-trips when the user switches tabs or re-visits a screen.

type CacheEntry<T> = { data: T; ts: number };
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const _productCache = new Map<string, CacheEntry<Product[]>>();
const _categoryCache = new Map<string, CacheEntry<Category[]>>();
const _shadesCache = new Map<string, CacheEntry<ProductShade[]>>();

function cacheKey(opts: Record<string, unknown>): string {
  return JSON.stringify(opts, Object.keys(opts).sort());
}

function cacheGet<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { map.delete(key); return null; }
  return entry.data;
}

function cacheSet<T>(map: Map<string, CacheEntry<T>>, key: string, data: T): void {
  map.set(key, { data, ts: Date.now() });
}

/** Clear all storefront caches (call after admin product edits). */
export function clearStorefrontCache(): void {
  _productCache.clear();
  _categoryCache.clear();
  _shadesCache.clear();
}

// ─── Storefront API ───────────────────────────────────────────────────────────

export async function fetchProducts(opts?: {
  category?: string;
  makeup_subcategory?: string;
  featured?: boolean;
  language?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<Product[]> {
  const lang = opts?.language ?? 'en';
  const limit = opts?.limit ?? 24;
  const offset = opts?.offset ?? 0;

  const key = cacheKey({ ...opts, language: lang, limit, offset });
  const cached = cacheGet(_productCache, key);
  if (cached) return cached;

  // Select only columns needed for list/card rendering — exclude large blobs
  let query = supabase
    .from('products')
    .select(`
      id, name, name_ar, name_es, name_de, price, compare_price,
      category, category_id, makeup_subcategory, image_url, main_image,
      rating, review_count, badge, is_featured, featured, stock, in_stock, status,
      slug, try_on_type, created_at,
      translation:product_translations!left(language, name, short_description)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts?.status !== undefined) {
    query = query.eq('status', opts.status);
  } else {
    query = query.eq('status', 'active');
  }
  if (opts?.category) query = query.eq('category', opts.category);
  if (opts?.makeup_subcategory) query = query.eq('makeup_subcategory', opts.makeup_subcategory);
  if (opts?.featured) query = query.eq('is_featured', true);

  const { data, error } = await query;
  if (error) throw error;

  const result = (data ?? []).map((row) => normalizeProductWithLanguage(row, lang));
  cacheSet(_productCache, key, result);
  return result;
}

export async function fetchProductById(id: string, language = 'en'): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      translation:product_translations!left(id, product_id, language, name, short_description, full_description, meta_title, meta_description)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return normalizeProductWithLanguage(data, language);
}

export async function fetchCategories(language = 'en'): Promise<Category[]> {
  const key = `cats:${language}`;
  const cached = cacheGet(_categoryCache, key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('categories')
    .select(`
      *,
      translation:category_translations!left(id, category_id, language, name, description)
    `)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('slug', { ascending: true });

  if (error) throw error;
  const result = (data ?? []).map((row) => normalizeCategoryRowWithLanguage(row, language));
  cacheSet(_categoryCache, key, result);
  return result;
}

export async function fetchCMSContent(language = 'en'): Promise<CMSContent | null> {
  const { data, error } = await supabase
    .from('cms_content')
    .select('*')
    .eq('language', language)
    .maybeSingle();

  if (error) throw error;

  // Fallback to English if requested language not found
  if (!data && language !== 'en') {
    const { data: enData } = await supabase
      .from('cms_content')
      .select('*')
      .eq('language', 'en')
      .maybeSingle();
    return enData ?? null;
  }
  return data ?? null;
}

/**
 * Ensures all language rows exist in product_translations for a given product.
 * Any missing language row is seeded from English content.
 * Called after creating or updating a product in the admin.
 */
export async function ensureProductTranslations(
  db: ReturnType<typeof adminSupabase>,
  productId: string,
  englishName: string,
  englishDescription: string
): Promise<void> {
  const LANGUAGES = ['ar', 'es', 'de', 'ru', 'ckb'];

  // Fetch existing translations
  const { data: existing } = await supabase
    .from('product_translations')
    .select('language')
    .eq('product_id', productId);

  const existingLangs = new Set((existing ?? []).map((r: { language: string }) => r.language));

  const missing = LANGUAGES.filter((lang) => !existingLangs.has(lang));
  if (missing.length === 0) return;

  await db.from('product_translations').upsert(
    missing.map((lang) => ({
      product_id: productId,
      language: lang,
      name: englishName,
      short_description: englishDescription,
      full_description: englishDescription,
      meta_title: englishName,
      meta_description: englishDescription,
    })),
    { onConflict: 'product_id,language' }
  );
}

/**
 * Ensures all 5 language rows exist in category_translations for a given category.
 * Any missing language row is seeded from the English name.
 */
export async function ensureCategoryTranslations(
  db: ReturnType<typeof adminSupabase>,
  categoryId: string,
  englishName: string,
  englishDescription: string
): Promise<void> {
  const LANGUAGES = ['ar', 'es', 'de', 'ru'];

  const { data: existing } = await supabase
    .from('category_translations')
    .select('language')
    .eq('category_id', categoryId);

  const existingLangs = new Set((existing ?? []).map((r: { language: string }) => r.language));
  const missing = LANGUAGES.filter((lang) => !existingLangs.has(lang));
  if (missing.length === 0) return;

  await db.from('category_translations').upsert(
    missing.map((lang) => ({
      category_id: categoryId,
      language: lang,
      name: englishName,
      description: englishDescription,
    })),
    { onConflict: 'category_id,language' }
  );
}

/**
 * Ensures homepage_content rows exist for all 5 languages for a given section/key.
 * Missing rows are seeded from English.
 */
export async function ensureHomepageContentAllLanguages(
  db: ReturnType<typeof adminSupabase>,
  section: string,
  key: string,
  englishValue: string
): Promise<void> {
  const LANGUAGES = ['ar', 'es', 'de', 'ru'];

  const { data: existing } = await supabase
    .from('homepage_content')
    .select('language')
    .eq('section', section)
    .eq('key', key);

  const existingLangs = new Set((existing ?? []).map((r: { language: string }) => r.language));
  const missing = LANGUAGES.filter((lang) => !existingLangs.has(lang));
  if (missing.length === 0) return;

  await db.from('homepage_content').upsert(
    missing.map((lang) => ({
      section,
      key,
      value: englishValue,
      language: lang,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'section,key,language' }
  );
}

export async function fetchThemeSettings(): Promise<ThemeSettings | null> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')
    .like('key', 'theme_%');

  if (error || !data || data.length === 0) return null;

  const map: Record<string, string> = {};
  for (const row of data) map[row.key] = row.value;

  return {
    primary_color:         map['theme_primary_color']         ?? '#FF4D8D',
    secondary_color:       map['theme_secondary_color']       ?? '#1E0F18',
    accent_color:          map['theme_accent_color']          ?? '#FFD700',
    button_color:          map['theme_button_color']          ?? '#FF4D8D',
    button_text_color:     map['theme_button_text_color']     ?? '#FFFFFF',
    background_color:      map['theme_background_color']      ?? '#0A0507',
    card_background_color: map['theme_card_background_color'] ?? '#1E0F18',
    border_color:          map['theme_border_color']          ?? 'rgba(255,77,141,0.15)',
    glow_color:            map['theme_glow_color']            ?? 'rgba(255,77,141,0.08)',
    text_primary_color:    map['theme_text_primary_color']    ?? '#FDE8F0',
    text_secondary_color:  map['theme_text_secondary_color']  ?? '#D67EB0',
    warning_color:         map['theme_warning_color']         ?? '#FFB300',
    success_color:         map['theme_success_color']         ?? '#00E676',
    active_preset:         map['theme_active_preset']         ?? 'rose-glow',
  };
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeProduct(row: any): Product {
  const translations: any[] = Array.isArray(row.translation) ? row.translation : (row.translation ? [row.translation] : []);
  const translation = translations[0] ?? null;
  const images: string[] = Array.isArray(row.images) ? row.images : (row.images ? Object.values(row.images) : []);
  return {
    ...row,
    translation,
    images: images.length > 0 ? images : [row.main_image || row.image_url].filter(Boolean),
  };
}

/**
 * Picks the correct language translation from all joined rows.
 * Falls back to English, then to null. This avoids the PostgREST
 * left-join filter bug where .eq('table.language', lang) turns the
 * left join into an inner join and drops products with no translation.
 */
function normalizeProductWithLanguage(row: any, language: string): Product {
  const allTranslations: any[] = Array.isArray(row.translation)
    ? row.translation
    : row.translation ? [row.translation] : [];

  const translation =
    allTranslations.find((t) => t.language === language) ??
    allTranslations.find((t) => t.language === 'en') ??
    allTranslations[0] ??
    null;

  const images: string[] = Array.isArray(row.images)
    ? row.images
    : row.images ? Object.values(row.images) : [];

  return {
    ...row,
    translation,
    images: images.length > 0 ? images : [row.main_image || row.image_url].filter(Boolean),
  };
}

function normalizeCategoryRow(row: any): Category {
  const translations: any[] = Array.isArray(row.translation) ? row.translation : (row.translation ? [row.translation] : []);
  return {
    ...row,
    translation: translations[0] ?? null,
  };
}

function normalizeCategoryRowWithLanguage(row: any, language: string): Category {
  const allTranslations: any[] = Array.isArray(row.translation)
    ? row.translation
    : row.translation ? [row.translation] : [];

  const translation =
    allTranslations.find((t) => t.language === language) ??
    allTranslations.find((t) => t.language === 'en') ??
    allTranslations[0] ??
    null;

  return { ...row, translation };
}

// ─── Related Products ─────────────────────────────────────────────────────────

/**
 * Fetches and ranks related products for a given product.
 *
 * Scoring (higher = more relevant):
 *   +40  same category string
 *   +20  same category_id (subcategory precision)
 *   +15  is bestseller — is_featured=true OR badge='BESTSELLER'
 *   +10  price within 30% of current product's price
 *   +10  high rating (≥ 4.5)
 *   +5   popular (review_count ≥ 100)
 *   +3   per overlapping specification key (material, size, weight, etc.)
 *   -50  out of stock (stock === 0) — effectively deprioritises unless no alternatives
 *
 * Returns up to `limit` products sorted by score descending.
 */
export async function getRelatedProducts(
  product: Product,
  language = 'en',
  limit = 4
): Promise<Product[]> {
  // Fetch a smaller pool — same category preferred, slim columns for cards
  const { data: pool, error } = await supabase
    .from('products')
    .select(`
      id, name, name_ar, name_es, name_de, price, compare_price,
      category, category_id, makeup_subcategory, image_url, main_image,
      rating, review_count, badge, is_featured, featured, stock, in_stock, status,
      slug, try_on_type, specifications, created_at,
      translation:product_translations!left(language, name, short_description)
    `)
    .eq('status', 'active')
    .eq('category', product.category)
    .neq('id', product.id)
    .order('is_featured', { ascending: false })
    .order('review_count', { ascending: false })
    .limit(20);

  if (error || !pool) return [];

  const normalized = pool.map((row) => normalizeProductWithLanguage(row, language));
  const specsKeys = Object.keys(product.specifications ?? {});

  const scored = normalized.map((p) => {
    let score = 0;

    // Category match
    if (p.category === product.category) score += 40;
    if (p.category_id && p.category_id === product.category_id) score += 20;

    // Bestseller signals
    if (p.is_featured || p.featured || p.badge === 'BESTSELLER') score += 15;

    // Price proximity (within 30%)
    if (product.price > 0) {
      const ratio = Math.abs(p.price - product.price) / product.price;
      if (ratio <= 0.3) score += 10;
    }

    // High rating
    if (p.rating >= 4.5) score += 10;

    // Popular
    if (p.review_count >= 100) score += 5;

    // Spec key overlap
    if (specsKeys.length > 0 && p.specifications) {
      const overlap = specsKeys.filter((k) => k in p.specifications!).length;
      score += overlap * 3;
    }

    // Out of stock penalty
    if (p.stock === 0) score -= 50;

    return { product: p, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.product);
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const EMPLOYEE_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'product_manager', label: 'Product Manager' },
  { value: 'order_manager', label: 'Order Manager' },
  { value: 'customer_support', label: 'Customer Support' },
  { value: 'content_editor', label: 'Content Editor' },
];

export const EMPLOYEE_PERMISSIONS = [
  { value: 'manage_products', label: 'Manage Products' },
  { value: 'manage_orders', label: 'Manage Orders' },
  { value: 'manage_customers', label: 'Manage Customers' },
  { value: 'manage_employees', label: 'Manage Employees' },
  { value: 'manage_content', label: 'Manage Content' },
  { value: 'view_analytics', label: 'View Analytics' },
  { value: 'manage_settings', label: 'Manage Settings' },
];

export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
