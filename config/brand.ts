/**
 * Centralized brand configuration.
 *
 * To white-label this app for a different brand, change the values in
 * BRAND_CONFIG only. All other files import from here.
 *
 * Language rules:
 *   - brandName.en  → shown in all Latin-script languages (en, es, de, ru, fr…)
 *   - brandName.ar  → shown in Arabic and Kurdish (Arabic-script languages)
 */

export const BRAND_CONFIG = {
  // ── Identity ───────────────────────────────────────────────────────────────
  brandName: {
    en: 'Lazurde',
    ar: 'لازوردي',
  },
  brandShortName: 'LAZURDE',
  brandFullName: 'Lazurde Makeup',
  tagline: 'MAKEUP',

  // ── Visual ─────────────────────────────────────────────────────────────────
  logo: '',            // URL to logo image; empty string = text logo fallback
  favicon: '',         // URL to favicon; empty = default expo favicon

  primaryColor: '#FF4D8D',
  primaryColorDim: '#CC3066',
  secondaryColor: '#E0356E',

  // ── Domain & Links ─────────────────────────────────────────────────────────
  domain: 'lazurdebeauty.com',
  websiteUrl: 'https://lazurdebeauty.com',

  // ── Contact ────────────────────────────────────────────────────────────────
  supportEmail: 'support@lazurdebeauty.com',
  supportPhone: '+964 770 000 0000',
  adminEmail: 'admin@lazurdemakeup.com',
  ordersEmail: 'orders@lazurdebeauty.com',
  noReplyEmail: 'noreply@lazurdebeauty.com',

  whatsappNumber: '9647700000000',  // digits only, no +

  // ── Social Media ───────────────────────────────────────────────────────────
  instagramUrl: '',
  facebookUrl: '',
  tiktokUrl: '',

  // ── Currency ───────────────────────────────────────────────────────────────
  currency: 'IQD',
  currencySymbol: 'د.ع',
  currencyLocale: 'ar-IQ',

  // ── Internal / Auth ────────────────────────────────────────────────────────
  /** Suffix appended to synthetic emails created for phone-OTP users. */
  phoneOtpEmailSuffix: '@otp.lazurde.internal',

  // ── Legal ──────────────────────────────────────────────────────────────────
  copyrightYear: 2026,
  copyrightText: '© 2026 Lazurde Makeup. All rights reserved.',
} as const;

/** Languages that use Arabic script and should receive the Arabic brand name. */
const ARABIC_SCRIPT_LANGS = new Set(['ar', 'ckb']);

/**
 * Returns the correct brand name for the given language code.
 *
 * Examples:
 *   getBrandName('en')  → 'Lazurde'
 *   getBrandName('ar')  → 'لازوردي'
 *   getBrandName('ckb') → 'لازوردي'
 *   getBrandName('ru')  → 'Lazurde'
 *   getBrandName('de')  → 'Lazurde'
 */
export function getBrandName(language?: string): string {
  if (language && ARABIC_SCRIPT_LANGS.has(language)) {
    return BRAND_CONFIG.brandName.ar;
  }
  return BRAND_CONFIG.brandName.en;
}

/** Alias kept for explicit readability at call sites. */
export const getBrandNameByLanguage = getBrandName;

/** Full brand name (includes product line / sub-brand). */
export function getBrandFullName(language?: string): string {
  if (language && ARABIC_SCRIPT_LANGS.has(language)) {
    return `${BRAND_CONFIG.brandName.ar}`;
  }
  return BRAND_CONFIG.brandFullName;
}

/**
 * Build a product share URL for the current brand domain.
 * Falls back to the current browser URL on web.
 */
export function buildProductUrl(productId: string): string {
  if (typeof window !== 'undefined') return window.location.href;
  return `${BRAND_CONFIG.websiteUrl}/product/${productId}`;
}

/** WhatsApp deep-link URL. */
export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${BRAND_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
