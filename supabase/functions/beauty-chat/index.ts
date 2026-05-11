import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Dialect = "iraqi" | "gulf" | "msa" | "english";
type RecType = "skincare" | "makeup" | "both";
type Lang = "en" | "ar" | "es" | "de" | "ru";

type Intent =
  | "greeting" | "product_search" | "shade_help" | "skincare_advice"
  | "routine" | "skin_tone_analysis" | "skin_concern_analysis"
  | "general_beauty" | "unknown";

interface SkinConcern {
  key: string;
  label: string;
  severity: "mild" | "moderate" | "high";
}

interface ProductRow {
  id: string;
  name: string;
  price: number;
  image_url: string;
  main_image: string | null;
  category: string;
  makeup_subcategory: string | null;
  rating: number;
  review_count: number;
  badge: string | null;
  description: string;
  purpose: string | null;
  ingredients: string[] | null;
  concerns: string[] | null;
  skin_types: string[] | null;
  suitable_undertone: string[] | null;
  is_featured: boolean;
  in_stock: boolean;
  stock: number;
}

interface RoutineStep {
  step: number;
  label: string;
  product: RecommendedProduct;
  why: string;
}

interface Routine {
  title: string;
  type: "skincare" | "makeup" | "both";
  steps: RoutineStep[];
  closing: string;
}

interface RecommendedProduct {
  id: string;
  name: string;
  image: string;
  price: number;
  category: string;
  rating: number;
  review_count: number;
  badge: string | null;
  reason: string;
}

// ─── Routine step definitions ─────────────────────────────────────────────────

const SKINCARE_STEPS: { label: string; categories: string[]; required: boolean }[] = [
  { label: "Cleanser",    categories: ["cleanser"],    required: true  },
  { label: "Serum",       categories: ["serum"],       required: false },
  { label: "Moisturizer", categories: ["moisturizer"], required: true  },
  { label: "Sunscreen",   categories: ["sunscreen"],   required: true  },
];

const MAKEUP_STEPS: { label: string; categories: string[]; required: boolean }[] = [
  { label: "Primer",      categories: ["primer"],                          required: false },
  { label: "Foundation",  categories: ["foundation"],                      required: true  },
  { label: "Concealer",   categories: ["concealer"],                       required: true  },
  { label: "Blush",       categories: ["blush", "bronzer"],                required: false },
  { label: "Eyes",        categories: ["eyeshadow", "eyeliner", "mascara"],required: false },
  { label: "Lips",        categories: ["lipstick"],                        required: false },
  { label: "Set",         categories: ["powder", "highlighter"],           required: false },
];

// ─── Dialect detection ────────────────────────────────────────────────────────

const IRAQI_MARKERS = [
  "شلون","شلونك","شلونج","شكو","ماكو","هواية","هواي","زين","اريد","اريده",
  "چان","هيچي","شنو","شسوي","يوميه","حيل","ليش","گلت","چا","اكو","ابد",
  "هسه","يابه","خوش","صار","تره","مو","هاي","حجي","احجي","عيني","بالي",
  "تدلني","دلني","شنهو","اشقد","وين","منين","شگد","خوية","ابي","بيه","جذي",
];
const GULF_MARKERS = [
  "وش","ايش","كيف","كيفك","كيفج","حياك","يعطيك","حلو","وايد","كذا",
  "ابي","ابغى","يبيلي","الحين","ذحين","يالله","مره","شفيك","عطني","عطيني",
  "ودي","تكفى","تكفين","ويش","طيب","اهم شي","يناسب","عجبني","يجنن","يهبل",
  "خطير","توني","ابيك","تنصحني","ترشحي","حبيبتي","ايه","تراه","ترا","مدري",
];
const MSA_MARKERS = [
  "أريد","أحتاج","ما هو","ما هي","كيف يمكن","أفضل","أبحث","الرجاء",
  "من فضلك","شكراً","هل يمكنك","ماذا","لماذا","بشرتي","بشرة","أنصحني",
  "المكياج","التجميل","مستحضرات","أرجو","ساعديني","ساعدني","توصية","نصيحة",
];

function hasArabicChars(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
}

function detectDialect(text: string): Dialect {
  const t = text.trim();
  if (!hasArabicChars(t)) return "english";
  let ir = 0, gu = 0, ms = 0;
  for (const m of IRAQI_MARKERS) if (t.includes(m)) ir += 2;
  for (const m of GULF_MARKERS) if (t.includes(m)) gu += 2;
  for (const m of MSA_MARKERS) if (t.includes(m)) ms += 2;
  if (/شلون|هواي|شكو|ماكو|هيچي|چان|گلت|شگد/.test(t)) ir += 5;
  if (/وش\s|ابغى|وايد|الحين|ذحين|يبيلي|يهبل/.test(t)) gu += 5;
  if (/[\u064B-\u065F]/.test(t)) ms += 2;
  const max = Math.max(ir, gu, ms);
  if (max === 0) return hasArabicChars(t) ? "msa" : "english";
  if (ir === max) return "iraqi";
  if (gu === max) return "gulf";
  return "msa";
}

function resolveDialect(text: string, prev: Dialect | null, lang: Lang): Dialect {
  if (text.trim()) {
    const d = detectDialect(text);
    if (d === "english" && hasArabicChars(text) && prev && prev !== "english") return prev;
    if (d === "english" && lang === "ar") return prev ?? "msa";
    return d;
  }
  return prev ?? (lang === "ar" ? "msa" : "english");
}

// ─── Intent detection ─────────────────────────────────────────────────────────

function detectIntent(msg: string): Intent {
  const m = msg.toLowerCase();
  if (/^(hi|hello|hey|hola|buenos|good\s*(morning|evening|afternoon)|salam|مرحبا|السلام|هلا|اهلا|هلو|الو|هاي|hallo|guten|привет|здравствуй)/i.test(m)) return "greeting";
  if (/shade|لون|ظل|درجة|color\s*(match|recommend|find)|which\s*(shade|color)|right\s*shade|تناسب لوني|يناسب بشرتي|اي لون|tono|оттенок/i.test(m)) return "shade_help";
  if (/skin\s*concern|dryness|oily|oiliness|redness|acne|dark\s*circle|uneven\s*tone|pore|wrinkle|pigment|جفاف|دهني|احمرار|حب شباب|هالات|تصبغ|تجاعيد|акне|круги/i.test(m)) return "skin_concern_analysis";
  if (/skin\s*tone|skin\s*type|analyz|detect|upload.*(face|photo|selfie)|نوع بشرت|تحليل|صورة وجه|سيلفي|لون بشرت|тип кожи|анализ/i.test(m)) return "skin_tone_analysis";
  if (/routine|روتين|خطوات|steps?\s*(for|to)|how\s*(to|do)\s*(apply|use)|tutorial|daily|يومي|كيف اسوي|شلون اسوي|طريقة|rutina|рутин/i.test(m)) return "routine";
  if (/skincare|skin\s*care|moisturiz|sunscreen|cleanser|serum|عناية|ترطيب|واقي شمس|منظف|سيروم|cuidado|pflege|уход/i.test(m)) return "skincare_advice";
  if (/hair|شعر|شامبو|shampoo|scalp|فروة/i.test(m)) return "product_search";
  if (/recommend|suggest|best|looking\s*for|show\s*me|lipstick|foundation|blush|concealer|mascara|primer|powder|eyeshadow|eyeliner|bronzer|highlighter|lip|رو[جژ]|فاونديشن|بلاشر|كونسيلر|ماسكرا|برايمر|بودر|ايشادو|آيلاينر|هايلايتر|احمر شفاه|كريم اساس|منتج|ابي شي|ابغى شي|اريد شي|دلني|رشحي|نصحني|labial|помада|тушь/i.test(m)) return "product_search";
  if (/beauty|makeup|cosmetic|look|glam|natural|مكياج|ميكاب|تجميل|لوك|جمال|حلو|مناسب|belleza|maquillaje|красота|макияж/i.test(m)) return "general_beauty";
  return "unknown";
}

// ─── Semantic category mapping ────────────────────────────────────────────────
// Maps user keywords → actual product category values in the DB

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // Makeup
  lipstick:    ["lipstick","lip ","lips ","lip gloss","lip liner","روج","احمر شفاه","حمرة","شفايف","ليب","labial","помада","lipcolor"],
  foundation:  ["foundation","base coat","complexion","فاونديشن","كريم اساس","اساس","تاسيس","تональный","bb cream","cc cream"],
  blush:       ["blush","cheek color","بلاشر","خدود","rouge","румяна","احمر خدود"],
  concealer:   ["concealer","under eye","كونسيلر","خافي عيوب","هالات","консилер","مخفي"],
  mascara:     ["mascara","lash","ماسكرا","رموش","тушь","mascara"],
  primer:      ["primer","prep skin","برايمر","اساس تحضيري"],
  powder:      ["powder","setting powder","بودر","بودرة","пудра","compact"],
  eyeshadow:   ["eyeshadow","eye shadow","ايشادو","ظلال عيون","тени","pallete","palette"],
  eyeliner:    ["eyeliner","liner","kohl","آيلاينر","كحل عيون","подводка","kajal"],
  bronzer:     ["bronzer","contour","برونزر","كونتور","бронзер","sculpt"],
  highlighter: ["highlighter","glow","shimmer","هايلايتر","اضاءة وجه","хайлайтер","illuminat"],
  // Skincare
  cleanser:    ["cleanser","face wash","غسول وجه","منظف بشرة","очищающее","cleanse","wash"],
  moisturizer: ["moisturizer","face cream","مرطب","كريم وجه","увлажняющий","hydrate","cream"],
  serum:       ["serum","essence","سيروم","مصل","серум","ampoule"],
  sunscreen:   ["sunscreen","spf","sun protection","واقي شمس","солнцезащитный","sun cream","uva","uvb"],
  // Haircare
  haircare:    [
    "hair","shampoo","conditioner","scalp","شامبو","شعر","فروة الرأس","كوندشنر","مرطب شعر",
    "hair care","haircare","hair loss","تساقط شعر","hair oil","زيت شعر","hair mask","ماسك شعر",
    "oily hair","dry hair","شعر دهني","شعر جاف","damaged hair","شعر تالف",
  ],
  // General body
  makeup:      ["makeup","maquillage","مكياج","ميكاب","تجميل"],
};

function extractCategories(msg: string): string[] {
  const lower = msg.toLowerCase();
  const found = new Set<string>();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some((kw) => lower.includes(kw.toLowerCase()))) {
      found.add(cat);
    }
  }
  return [...found];
}

// ─── Concern extraction ────────────────────────────────────────────────────────

function extractConcernKeys(msg: string): string[] {
  const lower = msg.toLowerCase();
  const map: [RegExp, string][] = [
    [/oil|دهني|greasy|oily\s*(hair|skin|scalp)|شعر\s*دهني|فروة\s*دهنية/i, "oily"],
    [/acne|حب شباب|pimple|breakout|blemish/i, "acne"],
    [/redne|احمرار|rosacea/i, "redness"],
    [/dry|جفاف|flak|dry\s*(hair|skin)|شعر\s*جاف/i, "dryness"],
    [/dark\s*circle|هالات/i, "dark_circles"],
    [/uneven|pigment|تصبغ|discolor|dark\s*spot/i, "uneven_tone"],
    [/wrinkle|aging|تجاعيد|fine\s*line/i, "wrinkle"],
    [/spf|sun\s*screen|واقي/i, "spf"],
    [/bright|glow|نضارة/i, "brightening"],
    [/hydrat|moistur|رطوبة/i, "hydration"],
    [/hair\s*loss|thinning|تساقط/i, "hair_loss"],
    [/dandruff|قشرة/i, "dandruff"],
    [/frizz|كيرلي|curly/i, "frizz"],
    [/damage|تالف|brittle/i, "damaged_hair"],
  ];
  return map.filter(([rx]) => rx.test(lower)).map(([, k]) => k);
}

// Maps concern keys → ingredient terms for scoring
const CONCERN_TO_INGREDIENTS: Record<string, string[]> = {
  oily:         ["niacinamide", "salicylic acid", "zinc", "kaolin", "clay", "tea tree"],
  acne:         ["salicylic acid", "benzoyl peroxide", "niacinamide", "tea tree"],
  redness:      ["centella asiatica", "allantoin", "niacinamide", "aloe vera", "bisabolol"],
  dryness:      ["hyaluronic acid", "ceramide", "shea butter", "glycerin", "squalane", "argan", "coconut"],
  dark_circles: ["vitamin k", "caffeine", "retinol", "vitamin c", "peptide"],
  uneven_tone:  ["vitamin c", "niacinamide", "azelaic acid", "kojic acid"],
  pigmentation: ["vitamin c", "azelaic acid", "kojic acid", "niacinamide"],
  wrinkle:      ["retinol", "peptide", "hyaluronic acid", "vitamin c"],
  spf:          ["zinc oxide", "titanium dioxide", "spf"],
  hydration:    ["hyaluronic acid", "ceramide", "glycerin", "squalane"],
  brightening:  ["vitamin c", "niacinamide", "kojic acid"],
  hair_loss:    ["biotin", "caffeine", "keratin", "zinc", "minoxidil"],
  dandruff:     ["zinc pyrithione", "selenium", "salicylic acid", "tea tree", "ketoconazole"],
  frizz:        ["argan oil", "keratin", "coconut oil", "shea butter"],
  damaged_hair: ["keratin", "protein", "argan oil", "coconut oil", "biotin"],
};

const CONCERN_TO_DB_CONCERNS: Record<string, string[]> = {
  oily:         ["oiliness", "acne", "shine", "sebum", "enlarged pores", "oily hair", "oil control"],
  acne:         ["acne", "breakout", "blemish", "pores"],
  redness:      ["redness", "inflammation", "sensitive", "irritation"],
  dryness:      ["dryness", "dehydration", "flakiness", "barrier damage", "dry hair"],
  dark_circles: ["dark circles", "puffiness", "hyperpigmentation"],
  uneven_tone:  ["uneven tone", "discoloration", "hyperpigmentation", "dark spots"],
  wrinkle:      ["wrinkles", "fine lines", "aging"],
  hair_loss:    ["hair loss", "thinning", "shedding"],
  dandruff:     ["dandruff", "flaking scalp", "seborrheic"],
  frizz:        ["frizz", "humidity", "curly"],
  damaged_hair: ["damaged", "brittle", "split ends", "bleached"],
};

// ─── Skin color analysis ──────────────────────────────────────────────────────

function analyzeSkinFromColors(r: number, g: number, b: number): {
  toneKey: string;
  undertoneKey: string;
  concerns: SkinConcern[];
} {
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  const warmth = r - b;
  const redness = r - g;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);

  let toneKey: string;
  if (brightness > 200) toneKey = "fair";
  else if (brightness > 170) toneKey = "light";
  else if (brightness > 140) toneKey = "medium";
  else if (brightness > 100) toneKey = "tan";
  else if (brightness > 70) toneKey = "deep";
  else toneKey = "very_deep";

  let undertoneKey: string;
  if (warmth > 30) undertoneKey = "warm";
  else if (warmth < -10) undertoneKey = "cool";
  else undertoneKey = "neutral";

  const concerns: SkinConcern[] = [];
  if (redness > 40 && saturation > 50)
    concerns.push({ key: "redness", label: "Redness / Inflammation", severity: redness > 60 ? "high" : "moderate" });
  if (brightness < 120 && saturation < 30)
    concerns.push({ key: "dark_circles", label: "Hyperpigmentation / dark areas", severity: brightness < 90 ? "high" : "moderate" });
  if (saturation > 60 && Math.abs(r - g) > 20)
    concerns.push({ key: "uneven_tone", label: "Uneven skin tone", severity: saturation > 80 ? "high" : "mild" });
  if (warmth < -5 && brightness > 150)
    concerns.push({ key: "dryness", label: "Dehydration / dryness", severity: warmth < -20 ? "moderate" : "mild" });
  if (warmth > 40 && saturation > 40)
    concerns.push({ key: "oiliness", label: "Excess sebum / oiliness", severity: warmth > 55 ? "moderate" : "mild" });
  if (redness > 35 && brightness > 130 && brightness < 190 && !concerns.find((c) => c.key === "redness"))
    concerns.push({ key: "acne", label: "Acne-prone skin", severity: "mild" });

  return { toneKey, undertoneKey, concerns };
}

// ─── DB fetching — live catalog search ────────────────────────────────────────

/**
 * Score a product against the user's intent.
 * Returns a numeric score — higher = better match.
 */
function scoreProduct(
  p: ProductRow,
  targetCategories: string[],
  concernKeys: string[],
  undertone: string | null,
  toneKey: string | null,
  queryLower: string,
): number {
  let score = 0;

  const ingredientTerms = concernKeys.flatMap((k) => CONCERN_TO_INGREDIENTS[k] ?? []);
  const concernTerms    = concernKeys.flatMap((k) => CONCERN_TO_DB_CONCERNS[k] ?? []);

  // Category exact match — strongest signal
  if (targetCategories.includes(p.category)) score += 20;
  // makeup_subcategory match
  if (p.makeup_subcategory && targetCategories.includes(p.makeup_subcategory)) score += 15;

  // Text relevance — search name, description, purpose
  const searchableText = [p.name, p.description, p.purpose, p.category, p.makeup_subcategory]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Direct keyword hits in product text
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
  for (const word of queryWords) {
    if (searchableText.includes(word)) score += 5;
  }

  // Ingredient match
  const pIngr = (p.ingredients ?? []).map((i) => i.toLowerCase());
  for (const t of ingredientTerms) {
    if (pIngr.some((i) => i.includes(t))) score += 3;
  }

  // Concern match from product's own concerns array
  const pConc = (p.concerns ?? []).map((c) => c.toLowerCase());
  for (const t of concernTerms) {
    if (pConc.some((c) => c.includes(t))) score += 2;
  }

  // Skin type match
  if (concernKeys.includes("oily") && p.skin_types?.some((s) => /oil/.test(s.toLowerCase()))) score += 3;
  if (concernKeys.includes("dryness") && p.skin_types?.some((s) => /dry/.test(s.toLowerCase()))) score += 3;

  // Undertone match for makeup
  const makeupCats = ["foundation", "blush", "bronzer", "concealer", "lipstick"];
  if (undertone && p.suitable_undertone && makeupCats.includes(p.category)) {
    if (p.suitable_undertone.includes(undertone)) score += 4;
    else score -= 2;
  }

  // Foundation tone matching
  if (p.category === "foundation" && toneKey) {
    const nameLower = p.name.toLowerCase();
    if (["fair","light"].includes(toneKey) && nameLower.includes("fair")) score += 5;
    else if (["medium","tan"].includes(toneKey) && nameLower.includes("medium")) score += 5;
    else if (["deep","very_deep"].includes(toneKey) && nameLower.includes("tan")) score += 5;
  }

  // Quality signals
  if (p.is_featured) score += 2;
  if (p.rating >= 4.7) score += 2;
  else if (p.rating >= 4.5) score += 1;

  // In-stock preference
  if (p.in_stock && p.stock > 0) score += 3;
  else if (!p.in_stock || p.stock === 0) score -= 10;

  return score;
}

/**
 * Fetch products from the live catalog matching the user's query.
 * Uses a two-stage approach:
 * 1) Exact category match
 * 2) Full-text search fallback if category match yields too few results
 */
async function fetchRelevantProducts(
  db: ReturnType<typeof createClient>,
  targetCategories: string[],
  concernKeys: string[],
  undertone: string | null,
  toneKey: string | null,
  queryLower: string,
  limit: number = 6,
): Promise<ProductRow[]> {
  const selectCols = "id,name,price,image_url,main_image,category,makeup_subcategory,rating,review_count,badge,description,purpose,ingredients,concerns,skin_types,suitable_undertone,is_featured,in_stock,stock";

  let candidates: ProductRow[] = [];

  // Stage 1: category-filtered query (most relevant)
  if (targetCategories.length > 0) {
    const { data } = await db.from("products")
      .select(selectCols)
      .eq("status", "active")
      .in("category", targetCategories)
      .order("rating", { ascending: false })
      .limit(40);
    if (data) candidates = data as ProductRow[];
  }

  // Stage 2: if category query returned < 3 results, add full-text search across name/description/purpose
  if (candidates.length < 3 && queryLower.trim().length > 2) {
    // Build ilike terms from meaningful query words
    const words = queryLower
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 5); // limit to avoid too many OR conditions

    // Search across name, description, purpose with OR between words
    let query = db.from("products")
      .select(selectCols)
      .eq("status", "active")
      .order("rating", { ascending: false })
      .limit(40);

    if (words.length > 0) {
      // Use Postgres ilike with OR pattern — search name OR description OR purpose
      const namePattern = words.map((w) => `name.ilike.%${w}%`).join(",");
      const descPattern = words.map((w) => `description.ilike.%${w}%`).join(",");
      const purpPattern = words.map((w) => `purpose.ilike.%${w}%`).join(",");
      query = query.or(`${namePattern},${descPattern},${purpPattern}`);
    }

    const { data } = await query;
    if (data) {
      // Merge, dedup by id
      const seen = new Set(candidates.map((p) => p.id));
      for (const p of data as ProductRow[]) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          candidates.push(p);
        }
      }
    }
  }

  if (candidates.length === 0) return [];

  // Score and rank
  const scored = candidates.map((p) => ({
    product: p,
    score: scoreProduct(p, targetCategories, concernKeys, undertone, toneKey, queryLower),
  }));
  scored.sort((a, b) => b.score - a.score || b.product.rating - a.product.rating);

  // Return top results — only in-stock unless no in-stock products exist
  const inStockTop = scored.filter((s) => s.product.in_stock && s.product.stock > 0).slice(0, limit);
  if (inStockTop.length >= 2) {
    return inStockTop.map((s) => s.product);
  }
  // Fallback: include out-of-stock if in-stock results are scarce
  return scored.slice(0, limit).map((s) => s.product);
}

/**
 * Fetch the single best product for a routine step category.
 * Uses the same scoring logic as fetchRelevantProducts.
 */
async function fetchBestProductForCategory(
  db: ReturnType<typeof createClient>,
  categories: string[],
  concernKeys: string[],
  undertone: string | null,
  toneKey: string | null
): Promise<ProductRow | null> {
  const results = await fetchRelevantProducts(db, categories, concernKeys, undertone, toneKey, categories.join(" "), 5);
  return results[0] ?? null;
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(messages: { role: string; content: string }[], maxTokens = 450): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "gpt-4o", messages, max_tokens: maxTokens, temperature: 0.6 }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Routine builder ──────────────────────────────────────────────────────────

async function buildRoutine(
  db: ReturnType<typeof createClient>,
  opts: {
    recType: RecType;
    concernKeys: string[];
    undertone: string | null;
    toneKey: string | null;
    dialect: Dialect;
    lang: Lang;
    skinConcerns: SkinConcern[];
  }
): Promise<Routine | null> {
  const { recType, concernKeys, undertone, toneKey, dialect, lang, skinConcerns } = opts;

  const stepsToFill =
    recType === "skincare" ? SKINCARE_STEPS :
    recType === "makeup"   ? MAKEUP_STEPS   :
    [...SKINCARE_STEPS, ...MAKEUP_STEPS];

  const resolved = await Promise.all(
    stepsToFill.map(async (step) => {
      const product = await fetchBestProductForCategory(
        db, step.categories, concernKeys, undertone, toneKey
      );
      return { step, product };
    })
  );

  const filledSteps = resolved.filter((r) => r.product !== null);
  if (filledSteps.length === 0) return null;

  const langNote =
    dialect === "iraqi" ? "Iraqi Arabic dialect (informal, friendly, use words like شلون، هواية، خوش، هسه)" :
    dialect === "gulf"  ? "Gulf Arabic dialect (informal, friendly, use words like وايد، ابغى، يجنن، تراه)" :
    dialect === "msa"   ? "Modern Standard Arabic (فصحى, professional but warm)" :
    lang === "es" ? "Spanish" : lang === "de" ? "German" : lang === "ru" ? "Russian" : "English";

  const skinCtx = [
    toneKey   ? `Skin tone: ${toneKey}` : "",
    undertone ? `Undertone: ${undertone}` : "",
    skinConcerns.length > 0 ? `Detected concerns: ${skinConcerns.map(c => `${c.label} (${c.severity})`).join(", ")}` : "",
    concernKeys.length > 0  ? `User concerns: ${concernKeys.join(", ")}` : "",
  ].filter(Boolean).join(" | ");

  const stepList = filledSteps.map((r, i) =>
    `Step ${i + 1} — ${r.step.label}: "${r.product!.name}" | purpose: ${r.product!.purpose ?? r.product!.description?.slice(0,80)}`
  ).join("\n");

  const prompt = `You are a premium beauty expert. Generate a personalized routine for this customer.

Customer profile: ${skinCtx || "general beauty customer"}
Routine type: ${recType}
Language: ${langNote}

Products selected (one per step):
${stepList}

Return ONLY valid JSON in this exact shape:
{
  "title": "short premium routine title (e.g. Your Perfect Morning Routine)",
  "steps": [
    { "why": "one sentence max 12 words — why THIS product for THIS skin" }
  ],
  "closing": "one short motivating closing line"
}

Rules:
- title and closing must match the language (${langNote})
- Each why must be specific to the skin concern, NOT generic
- Mention the key active ingredient in the why sentence
- Max 12 words per why
- NO bullet points, NO markdown inside JSON strings`;

  let aiJson: { title: string; steps: { why: string }[]; closing: string };
  const raw = await callOpenAI([{ role: "user", content: prompt }], 500);
  const cleaned = raw.replace(/```json|```/g, "").trim();
  aiJson = JSON.parse(cleaned);

  const routineSteps: RoutineStep[] = filledSteps.map((r, i) => ({
    step: i + 1,
    label: r.step.label,
    product: {
      id: r.product!.id,
      name: r.product!.name,
      image: r.product!.main_image || r.product!.image_url,
      price: r.product!.price,
      category: r.product!.category,
      rating: r.product!.rating,
      review_count: r.product!.review_count,
      badge: r.product!.badge,
      reason: aiJson.steps[i]?.why ?? (r.product!.purpose ?? ""),
    },
    why: aiJson.steps[i]?.why ?? (r.product!.purpose ?? ""),
  }));

  return {
    title: aiJson.title,
    type: recType,
    steps: routineSteps,
    closing: aiJson.closing,
  };
}

// ─── Language instruction ─────────────────────────────────────────────────────

function languageInstruction(dialect: Dialect, lang: Lang): string {
  switch (dialect) {
    case "iraqi": return "Reply ONLY in Iraqi Arabic dialect. Use natural Iraqi expressions (شلون، هواية، چان، ابي، مو، هسه، خوش، صار، وين، گلت). Sound like a friendly Iraqi woman texting her friend — NOT formal, NOT MSA.";
    case "gulf":  return "Reply ONLY in Gulf Arabic dialect. Use natural Gulf expressions (وش، ابغى، وايد، الحين، يجنن، يهبل، تراه، مدري، حبيبتي). Sound like a friendly Gulf woman — NOT formal, NOT MSA.";
    case "msa":   return "Reply in clear Modern Standard Arabic (فصحى). Be professional but warm.";
    default:
      if (lang === "es") return "Reply in Spanish. Be warm and professional.";
      if (lang === "de") return "Reply in German. Be precise and professional.";
      if (lang === "ru") return "Reply in Russian. Be warm and professional.";
      return "Reply in English. Be warm and conversational.";
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return err("Method not allowed", 405);

    const body = await req.json();
    const message: string = body.message ?? "";
    const skinColors: { r: number; g: number; b: number } | null = body.skinColors ?? null;
    const prevDialect: Dialect | null = body.dialect ?? null;
    const recType: RecType = body.recType ?? "both";
    const lang: Lang = (["en","ar","es","de","ru"].includes(body.language) ? body.language : "en") as Lang;

    if (!message.trim() && !skinColors) return err("message is required");

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const dialect = resolveDialect(message, prevDialect, lang);
    const intent  = detectIntent(message);

    let skinData: ReturnType<typeof analyzeSkinFromColors> | null = null;
    if (skinColors) skinData = analyzeSkinFromColors(skinColors.r, skinColors.g, skinColors.b);

    const messageConcernKeys = extractConcernKeys(message);
    const skinConcernKeys    = skinData?.concerns.map((c) => c.key) ?? [];
    const allConcernKeys     = [...new Set([...messageConcernKeys, ...skinConcernKeys])];
    const categories         = extractCategories(message);
    const undertone          = skinData?.undertoneKey ?? null;
    const toneKey            = skinData?.toneKey ?? null;
    const queryLower         = message.toLowerCase();

    const suggestUpload   = ["shade_help","skin_tone_analysis","skin_concern_analysis","skincare_advice"].includes(intent) && !skinColors;
    const showRecTypePicker = intent === "skin_concern_analysis" && !skinColors;

    const isRoutineRequest =
      intent === "routine" ||
      (skinColors && recType !== "both") ||
      (skinColors && intent !== "product_search" && intent !== "shade_help");

    let routine: Routine | null = null;
    let products: RecommendedProduct[] = [];

    if (isRoutineRequest) {
      routine = await buildRoutine(db, {
        recType,
        concernKeys: allConcernKeys,
        undertone,
        toneKey,
        dialect,
        lang,
        skinConcerns: skinData?.concerns ?? [],
      });
    } else if (intent !== "greeting") {
      // Determine candidate categories for this query
      const SKINCARE_CATS = ["cleanser","moisturizer","serum","sunscreen"];
      const MAKEUP_CATS   = ["lipstick","foundation","blush","concealer","mascara","primer","powder","eyeshadow","eyeliner","bronzer","highlighter"];
      const HAIRCARE_CATS = ["haircare"];
      const allCats = recType === "skincare" ? SKINCARE_CATS :
                      recType === "makeup"   ? MAKEUP_CATS   :
                      [...SKINCARE_CATS, ...MAKEUP_CATS, ...HAIRCARE_CATS, "makeup"];

      // Use extracted categories if found; otherwise use all relevant for recType
      const finalCats = categories.length > 0 ? categories : allCats;

      const top = await fetchRelevantProducts(
        db, finalCats, allConcernKeys, undertone, toneKey, queryLower, 6
      );

      if (top.length > 0) {
        const langNote =
          dialect === "iraqi" ? "Iraqi Arabic dialect" :
          dialect === "gulf"  ? "Gulf Arabic dialect"  :
          dialect === "msa"   ? "Modern Standard Arabic" :
          lang === "es" ? "Spanish" : lang === "de" ? "German" : lang === "ru" ? "Russian" : "English";

        const skinCtx = [
          toneKey    ? `Tone: ${toneKey}`              : "",
          undertone  ? `Undertone: ${undertone}`       : "",
          allConcernKeys.length ? `Concerns: ${allConcernKeys.join(", ")}` : "",
        ].filter(Boolean).join(", ");

        const productList = top.map((p, i) =>
          `${i + 1}. ${p.name} (${p.category}${p.makeup_subcategory ? "/" + p.makeup_subcategory : ""}): ${p.purpose ?? p.description?.slice(0, 80)}`
        ).join("\n");

        const userQuestion = `Customer asked: "${message}"`;

        let reasons: string[] = top.map(() => "");
        try {
          const reasonRaw = await callOpenAI([{
            role: "user",
            content: `Beauty expert. ${userQuestion}
Customer profile: ${skinCtx || "general customer"}
Language: ${langNote}

For each product below, write ONE sentence (max 12 words) explaining why it matches what the customer asked for. Be specific — mention the key benefit or ingredient. Output ONLY a JSON array of strings.

Products:
${productList}`,
          }], 300);
          reasons = JSON.parse(reasonRaw.replace(/```json|```/g, "").trim());
        } catch {
          // fallback: use purpose/description
          reasons = top.map((p) => p.purpose ?? p.description?.slice(0, 80) ?? "");
        }

        products = top.slice(0, 5).map((p, i) => ({
          id: p.id,
          name: p.name,
          image: p.main_image || p.image_url,
          price: p.price,
          category: p.category,
          rating: p.rating,
          review_count: p.review_count,
          badge: p.badge,
          reason: reasons[i] ?? (p.purpose ?? ""),
        }));
      }
    }

    // ── Generate main AI reply ──
    const systemPrompt = `You are an expert dermatologist and professional makeup artist, working for Lazurde Makeup — a premium Middle Eastern cosmetics brand.

${languageInstruction(dialect, lang)}

Your personality: warm, direct, expert. Precise clinical advice without platitudes. Name specific ingredients.

${routine ? `A complete personalized routine has been built for the customer (shown as step cards). Your reply should:
1. ${skinData ? "Briefly state what the skin analysis revealed." : "Acknowledge the routine type requested."}
2. In 1-2 sentences, explain the overall strategy behind this routine.
3. End with one encouraging line. Total: max 3 sentences.` :
`${skinData ? "1. Briefly state what the skin analysis revealed (tone, undertone, top concern)." : ""}
2. Explain the root cause of the main issue with named ingredients.
3. Reference that matching products are shown as cards.
4. Max 3-4 sentences. No bullet points.`}

Rules:
- NEVER say "I cannot analyze" — skin data comes from pixel analysis
- NEVER give generic advice (drink water, sleep well)
- NEVER invent product names — products appear as cards
- NEVER use emojis unless the user did`;

    const contextParts: string[] = [];
    if (skinData) {
      const concernList = skinData.concerns.length > 0
        ? skinData.concerns.map((c) => `${c.label} (${c.severity})`).join(", ")
        : "no significant concerns detected";
      contextParts.push(`SKIN ANALYSIS: Tone: ${skinData.toneKey} | Undertone: ${skinData.undertoneKey} | Concerns: ${concernList}`);
    }
    if (routine) {
      contextParts.push(`ROUTINE BUILT: ${routine.title} — ${routine.steps.length} steps (${routine.steps.map(s => s.label).join(" → ")})`);
    } else if (products.length > 0) {
      contextParts.push(`MATCHED PRODUCTS: ${products.length} products shown as cards (categories: ${[...new Set(products.map(p => p.category))].join(", ")})`);
    }
    if (intent !== "unknown") contextParts.push(`Intent: ${intent}`);

    const userContent = contextParts.length > 0
      ? `${contextParts.join("\n")}\n\nUser message: ${message || "[User uploaded a photo for skin analysis]"}`
      : message;

    let reply = "";
    try {
      reply = await callOpenAI([
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ]);
    } catch (e) {
      console.error("OpenAI FAILED:", e);
      reply = "⚠️ AI not responding. Check OPENAI_API_KEY or OpenAI billing.";
    }

    return ok({
      reply,
      dialect,
      intent,
      routine,
      products: routine ? [] : products,
      skinAnalysis: skinData ? {
        tone: skinData.toneKey,
        undertone: skinData.undertoneKey,
        concerns: skinData.concerns,
        recommendations: [],
      } : null,
      suggestUpload,
      showRecTypePicker,
    });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("beauty-chat error:", message);
    return err(message, 500);
  }
});
