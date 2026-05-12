import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LANG_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  de: "German",
  ru: "Russian",
  ar: "Arabic",
  ckb: "Central Kurdish (Sorani)",
};

// Languages that use Arabic script — brand stays as Arabic script in these
const ARABIC_SCRIPT_LANGS = new Set(["ar", "ckb"]);

const BRAND_LATIN = "Lazurde";
const BRAND_ARABIC = "لازوردي";

// Arabic Unicode block range check — used to detect untranslated fallback
function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * Normalize brand names in a translated string.
 * - Arabic/Kurdish: wrong Arabic-script variants → official BRAND_ARABIC
 * - All other languages: wrong variants (including leaked Arabic) → BRAND_LATIN
 */
function normalizeBrand(text: string, targetLang: string): string {
  if (!text) return text;

  if (ARABIC_SCRIPT_LANGS.has(targetLang)) {
    // Arabic/Kurdish: fix wrong Arabic-script variants and leaked Latin brand
    return text
      .replace(/لازردي/g, BRAND_ARABIC)
      .replace(/لازورد(?!ي)/g, BRAND_ARABIC)
      .replace(/لازوردى/g, BRAND_ARABIC)
      .replace(/\bLazurde\b/gi, BRAND_ARABIC)
      .replace(/\bLazourde\b/gi, BRAND_ARABIC);
  } else {
    // All other languages: fix wrong Latin, Cyrillic, and leaked Arabic script
    return text
      // Cyrillic variants
      .replace(/Лазурде/gi, BRAND_LATIN)
      .replace(/Лазурди/gi, BRAND_LATIN)
      .replace(/Лазурда/gi, BRAND_LATIN)
      .replace(/Лазурдэ/gi, BRAND_LATIN)
      // Arabic script leaked into non-Arabic translation
      .replace(/لازوردي/g, BRAND_LATIN)
      .replace(/لازردي/g, BRAND_LATIN)
      .replace(/لازورد/g, BRAND_LATIN)
      // Wrong Latin variants
      .replace(/\bLazourde\b/gi, BRAND_LATIN)
      .replace(/\bLazorde\b/gi, BRAND_LATIN)
      .replace(/\bLazurdi\b/gi, BRAND_LATIN)
      .replace(/\bLazurdy\b/gi, BRAND_LATIN)
      .replace(/\bLazordi\b/gi, BRAND_LATIN)
      .replace(/\bLazordy\b/gi, BRAND_LATIN)
      .replace(/\bLazurda\b/gi, BRAND_LATIN)
      .replace(/\bLazurdo\b/gi, BRAND_LATIN)
      // Restore correct capitalisation (e.g. "lazurde" → "Lazurde")
      .replace(/\blazurde\b/gi, BRAND_LATIN);
  }
}

/** Inject brand rules into every AI prompt */
const BRAND_SYSTEM_INSTRUCTION = `CRITICAL BRAND RULES (follow exactly):
- "Lazurde" and "Lazurde Beauty" are protected brand names. NEVER translate, transliterate, or modify them in any way.
- When the target language uses Latin script (English, Spanish, German, Russian, etc.): always write "Lazurde" exactly (capital L, lowercase the rest).
- When the target language uses Arabic script (Arabic, Kurdish/Sorani): always write "لازوردي" exactly as-is.
- Do not convert "Lazurde" to Cyrillic, Arabic, or any other script.
- Do not change the spelling: not "Lazourde", not "Lazorde", not "Lazurdi", not "Лазурде".`;

async function translateWithOpenAI(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string
): Promise<string> {
  const sourceName = LANG_NAMES[sourceLang] ?? sourceLang;
  const targetName = LANG_NAMES[targetLang] ?? targetLang;

  console.log(`[ai-translate] ${sourceLang}→${targetLang} | text: ${text.slice(0, 80)}`);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: `${BRAND_SYSTEM_INSTRUCTION}\n\nTranslate this ${sourceName} product text to ${targetName}.\nReturn only the translated text.\nDo not explain.\nPreserve cosmetic/product meaning.\n\nText: ${text}`,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => String(response.status));
    console.error(`[ai-translate] OpenAI HTTP ${response.status}: ${errBody}`);
    throw new Error(`OpenAI API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();

  // Responses API: output is an array of message objects
  const raw: string =
    data?.output?.[0]?.content?.[0]?.text?.trim() ?? "";

  console.log(`[ai-translate] ${sourceLang}→${targetLang} | result: ${raw.slice(0, 80)}`);

  if (!raw) {
    throw new Error(`Empty translation result for ${sourceLang}→${targetLang}`);
  }

  // Guard: if target is not Arabic/Kurdish but result contains Arabic chars, translation failed
  if (!ARABIC_SCRIPT_LANGS.has(targetLang) && isArabic(raw)) {
    throw new Error(
      `Translation result for ${targetLang} appears to still be Arabic: "${raw.slice(0, 60)}"`
    );
  }

  // Apply brand protection as a post-processing safety net
  const translated = normalizeBrand(raw, targetLang);

  return translated;
}

interface SingleTranslateRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
}

interface BatchTranslateRequest {
  texts: Record<string, string>;
  targetLanguages: string[];
  sourceLanguage?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("[ai-translate] OPENAI_API_KEY not set");
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    // ── Single-field mode: { text, sourceLang, targetLang } ──────────────
    if (typeof body.text === "string" && typeof body.targetLang === "string") {
      const { text, sourceLang = "ar", targetLang }: SingleTranslateRequest = body;

      if (!text.trim()) {
        return new Response(JSON.stringify({ error: "text is empty" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const translated = await translateWithOpenAI(text, sourceLang, targetLang, apiKey);
      return new Response(JSON.stringify({ translated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Batch mode: { texts, targetLanguages, sourceLanguage } ───────────
    const { texts, targetLanguages, sourceLanguage = "ar" }: BatchTranslateRequest = body;

    if (!texts || typeof texts !== "object") {
      return new Response(JSON.stringify({ error: "texts must be an object" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(targetLanguages) || targetLanguages.length === 0) {
      return new Response(
        JSON.stringify({ error: "targetLanguages must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result: Record<string, Record<string, string>> = {};
    const fieldNames = Object.keys(texts);

    for (const lang of targetLanguages) {
      if (lang === sourceLanguage) continue;
      result[lang] = {};

      for (const field of fieldNames) {
        const sourceText = texts[field];
        if (!sourceText?.trim()) {
          result[lang][field] = "";
          continue;
        }
        try {
          result[lang][field] = await translateWithOpenAI(sourceText, sourceLanguage, lang, apiKey);
        } catch (err) {
          console.error(`[ai-translate] field "${field}" ${sourceLanguage}→${lang} failed:`, err);
          throw err;
        }
      }
    }

    return new Response(JSON.stringify({ translations: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ai-translate] unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Translation failed", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
