const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export type TranslateTexts = Record<string, string>;
export type TranslateResult = Record<string, Record<string, string>>;

const DEFAULT_TARGET_LANGUAGES = ['en', 'es', 'de', 'ru'];

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${supabaseAnonKey}`,
    Apikey: supabaseAnonKey,
  };
}

/**
 * Translate a single text string from sourceLang to targetLang via OpenAI.
 * Throws on failure — callers must handle errors explicitly.
 */
export async function translateOne(
  text: string,
  targetLang: string,
  sourceLang = 'ar'
): Promise<string> {
  console.log(`[translate] ${sourceLang}→${targetLang} | "${text.slice(0, 60)}"`);

  const res = await fetch(`${supabaseUrl}/functions/v1/ai-translate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ text, sourceLang, targetLang }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => String(res.status));
    console.error(`[translate] HTTP ${res.status}:`, body);
    throw new Error(`Translation failed (${res.status}): ${body}`);
  }

  const data = await res.json();

  if (data?.error) {
    console.error('[translate] API error:', data.error, data.details ?? '');
    throw new Error(data.error);
  }

  const translated: string = data?.translated ?? '';
  console.log(`[translate] ${sourceLang}→${targetLang} | result: "${translated.slice(0, 60)}"`);

  if (!translated) throw new Error(`Empty translation result for ${sourceLang}→${targetLang}`);
  return translated;
}

/**
 * Batch-translate multiple named fields from sourceLanguage into all targetLanguages.
 * Used by the re-translate (product list) flow which translates from English.
 * Throws on failure.
 */
export async function autoTranslate(
  texts: TranslateTexts,
  targetLanguages: string[] = DEFAULT_TARGET_LANGUAGES,
  sourceLanguage = 'ar'
): Promise<TranslateResult> {
  const nonEmpty: TranslateTexts = {};
  for (const [k, v] of Object.entries(texts)) {
    if (v && v.trim()) nonEmpty[k] = v.trim();
  }
  if (Object.keys(nonEmpty).length === 0) return {};

  const res = await fetch(`${supabaseUrl}/functions/v1/ai-translate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ texts: nonEmpty, targetLanguages, sourceLanguage }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => String(res.status));
    console.error(`[autoTranslate] HTTP ${res.status}:`, body);
    throw new Error(`Translation failed (${res.status}): ${body}`);
  }

  const data = await res.json();

  if (data?.error) {
    console.error('[autoTranslate] API error:', data.error, data.details ?? '');
    throw new Error(data.error);
  }

  return (data?.translations as TranslateResult) ?? {};
}
