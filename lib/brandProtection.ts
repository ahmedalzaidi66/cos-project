/**
 * Brand protection for Lazurde Beauty translations.
 *
 * Rules:
 * - "لازوردي" (Arabic) must stay as-is in Arabic and Kurdish (ckb).
 * - In all other languages (en, es, de, ru, etc.) it must become "Lazurde".
 * - "Lazurde" and "Lazurde Beauty" must never be incorrectly transliterated
 *   (e.g. "لازردي", "Lazourde", "Lazorde", "Лазурде", "Lazurdi", etc.)
 * - AI or Google Translate must not rename the brand.
 */

/** Languages where the Arabic script spelling is correct and should be preserved. */
const ARABIC_SCRIPT_LANGS = new Set(['ar', 'ckb']);

/**
 * Official brand name in each script group.
 * Arabic/Kurdish: Arabic script.
 * All other languages: Latin script.
 */
const BRAND_LATIN = 'Lazurde';
const BRAND_ARABIC = 'لازوردي';

/**
 * Known incorrect AI/Google transliterations and translations of "Lazurde"
 * that should be replaced with the canonical spelling.
 *
 * Latin-script variants (wrong → BRAND_LATIN):
 */
const WRONG_LATIN_VARIANTS: RegExp[] = [
  /Lazorde/gi,
  /Lazourde/gi,
  /Lazurdi/gi,
  /Lazurdy/gi,
  /Lazordi/gi,
  /Lazordy/gi,
  /Lazurda/gi,
  /Lazurdo/gi,
  /Laz[uU]rde/g,   // catches casing variants not already matched
  /\bLazurde\b/gi,  // canonical — used for exact-case restoration below
  // Cyrillic transliterations (Russian)
  /Лазурде/gi,
  /Лазурди/gi,
  /Лазурда/gi,
  /Лазурдэ/gi,
];

/**
 * Known incorrect Arabic/script variants that AI may produce when translating
 * from English back to Arabic (should stay as BRAND_ARABIC):
 */
const WRONG_ARABIC_VARIANTS: RegExp[] = [
  /لازردي/g,
  /لازورد/g,
  /لازوردى/g,
  /لازوردي بيوتي/g,  // will be replaced with BRAND_ARABIC + ' بيوتي' — handled separately
];

/**
 * Normalise brand names in a translated string.
 *
 * @param text         The translated text that may contain incorrect brand spellings.
 * @param targetLang   The language code of `text` (e.g. 'en', 'ar', 'ckb', 'ru').
 * @returns            Text with brand names corrected.
 */
export function normalizeBrandTranslations(text: string, targetLang: string): string {
  if (!text) return text;

  if (ARABIC_SCRIPT_LANGS.has(targetLang)) {
    // Arabic / Kurdish: fix wrong Arabic-script variants back to official Arabic spelling
    let result = text;
    for (const pattern of WRONG_ARABIC_VARIANTS) {
      result = result.replace(pattern, BRAND_ARABIC);
    }
    // Also ensure Latin "Lazurde" that leaked into Arabic/Kurdish text is converted
    result = result.replace(/\bLazurde\b/gi, BRAND_ARABIC);
    return result;
  } else {
    // All other languages (en, es, de, ru, …): fix wrong Latin/Cyrillic variants
    let result = text;

    // First replace Cyrillic variants
    result = result
      .replace(/Лазурде/gi, BRAND_LATIN)
      .replace(/Лазурди/gi, BRAND_LATIN)
      .replace(/Лазурда/gi, BRAND_LATIN)
      .replace(/Лазурдэ/gi, BRAND_LATIN);

    // Replace Arabic-script brand that leaked into non-Arabic translation
    result = result.replace(/لازوردي/g, BRAND_LATIN);
    result = result.replace(/لازردي/g, BRAND_LATIN);
    result = result.replace(/لازورد/g, BRAND_LATIN);

    // Replace common wrong Latin variants (order matters — specific before general)
    result = result
      .replace(/\bLazourde\b/gi, BRAND_LATIN)
      .replace(/\bLazorde\b/gi, BRAND_LATIN)
      .replace(/\bLazurdi\b/gi, BRAND_LATIN)
      .replace(/\bLazurdy\b/gi, BRAND_LATIN)
      .replace(/\bLazordi\b/gi, BRAND_LATIN)
      .replace(/\bLazordy\b/gi, BRAND_LATIN)
      .replace(/\bLazurda\b/gi, BRAND_LATIN)
      .replace(/\bLazurdo\b/gi, BRAND_LATIN);

    // Restore correct capitalisation for already-correct "lazurde" (wrong case)
    result = result.replace(/\blazurde\b/gi, BRAND_LATIN);

    return result;
  }
}

/**
 * Apply brand protection to an entire translation result object.
 * Works on both single-lang and nested lang→field→value structures.
 *
 * @param result     Translation result: Record<lang, Record<field, value>> or Record<field, value>
 * @param targetLang For flat objects, the single target language.
 */
export function normalizeBrandTranslationResult(
  result: Record<string, Record<string, string>>,
  _unused?: string
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [lang, fields] of Object.entries(result)) {
    out[lang] = {};
    for (const [field, value] of Object.entries(fields)) {
      out[lang][field] = normalizeBrandTranslations(value, lang);
    }
  }
  return out;
}

/**
 * System prompt snippet to instruct the AI to never translate brand names.
 * Inject this into the OpenAI prompt.
 */
export const BRAND_PROTECTION_PROMPT = `IMPORTANT RULES:
- "Lazurde" and "Lazurde Beauty" are brand names. NEVER translate, transliterate, or modify them.
- In Arabic and Kurdish: keep "لازوردي" exactly as written.
- In all other languages: always write "Lazurde" (Latin script, exact spelling).
- Do not convert "Lazurde" to any other script or spelling.`;
