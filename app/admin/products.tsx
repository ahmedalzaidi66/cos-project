import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Switch,
  Image,
  Platform,
  ScrollView,
} from 'react-native';
import OptimizedImage from '@/components/OptimizedImage';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useRouter } from 'expo-router';
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  X,
  Search,
  Package,
  CircleAlert as AlertCircle,
  Globe,
  CircleCheck as CheckCircle,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Palette,
  Pipette,
  RotateCcw,
} from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { usePermissions } from '@/hooks/usePermissions';
import { logAdminAction } from '@/lib/auditLog';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import Toast from '@/components/admin/Toast';
import ImageUploader from '@/components/admin/ImageUploader';
import ProductImageGallery from '@/components/admin/ProductImageGallery';
import { supabase, adminSupabase, getAdminToken, Product, Category, Subcategory, getProductName, fetchSubcategories, getSubcategoryName } from '@/lib/supabase';
import { normalizeBrandTranslations } from '@/lib/brandProtection';
import { useActionPermission } from '@/hooks/useActionPermission';
import { adminSendNotification } from '@/context/NotificationContext';
import { extractDominantColor } from '@/lib/colorExtract';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';

// Fallback static list used until DB categories load
const FALLBACK_CATEGORIES = ['lipstick', 'blush', 'concealer', 'foundation', 'skincare', 'accessories', 'tools', 'sets'];

// Shared language config — DB code, display label, Google Translate code
const TRANSLATION_LANGUAGES = [
  { code: 'ar',  label: 'AR', googleCode: 'ar' },
  { code: 'en',  label: 'EN', googleCode: 'en' },
  { code: 'es',  label: 'ES', googleCode: 'es' },
  { code: 'de',  label: 'DE', googleCode: 'de' },
  { code: 'ru',  label: 'RU', googleCode: 'ru' },
  { code: 'ku',  label: 'KU', googleCode: 'ckb' },
] as const;

// Normalise any language code/name to the canonical DB value before saving
function normalizeLang(lang: string): string {
  const l = String(lang ?? '').trim().toLowerCase();
  if (l === 'arabic')                          return 'ar';
  if (l === 'english')                         return 'en';
  if (l === 'spanish')                         return 'es';
  if (l === 'german')                          return 'de';
  if (l === 'russian')                         return 'ru';
  if (l === 'kurdish' || l === 'kur' || l === 'ckb') return 'ku';
  return l;
}

// Map form's internal LangCode (which uses 'ckb' for Kurdish) to DB code
function formLangToDb(lang: string): string {
  return normalizeLang(lang);
}

// Map form's internal LangCode to Google Translate code
function formLangToGoogle(lang: string): string {
  const db = normalizeLang(lang);
  const entry = TRANSLATION_LANGUAGES.find((l) => l.code === db);
  return entry?.googleCode ?? db;
}

// Reverse: map Google Translate code back to our internal lang code
function googleToFormLang(googleCode: string): string {
  const entry = TRANSLATION_LANGUAGES.find((l) => l.googleCode === googleCode);
  return entry?.code ?? googleCode;
}

type LangCode = 'en' | 'ar' | 'es' | 'de' | 'ru' | 'ckb';

const LANG_TABS: { code: LangCode; label: string; nativeLabel: string; rtl: boolean }[] = [
  { code: 'ar',  label: 'AR', nativeLabel: 'العربية',  rtl: true  },
  { code: 'en',  label: 'EN', nativeLabel: 'English',  rtl: false },
  { code: 'es',  label: 'ES', nativeLabel: 'Español',  rtl: false },
  { code: 'de',  label: 'DE', nativeLabel: 'Deutsch',  rtl: false },
  { code: 'ru',  label: 'RU', nativeLabel: 'Русский',  rtl: false },
  { code: 'ckb', label: 'KU', nativeLabel: 'کوردی',    rtl: true  },
];

const TRYON_TYPE_OPTIONS = ['', 'lipstick', 'blush', 'concealer', 'foundation'] as const;
type TryOnTypeOption = typeof TRYON_TYPE_OPTIONS[number];

type MakeupSubcategory = 'lips' | 'face' | 'eye' | 'nail';

const MAKEUP_SUBCATEGORIES: { value: MakeupSubcategory; label: string }[] = [
  { value: 'lips', label: 'Lips' },
  { value: 'face', label: 'Face' },
  { value: 'eye', label: 'Eye' },
  { value: 'nail', label: 'Nail' },
];

const EMPTY_FORM = {
  name: '',
  price: '',
  category: 'accessories',
  try_on_type: '' as TryOnTypeOption,
  makeup_subcategory: '' as MakeupSubcategory | '',
  subcategory_id: '' as string,
  description: '',
  image_url: '',
  stock: '',
  badge: '',
  badge_ar: '',
  is_featured: false,
  rating: '4.5',
  review_count: '0',
  name_ar: '',
  name_es: '',
  name_de: '',
  name_ru: '',
  name_ckb: '',
  description_ar: '',
  description_es: '',
  description_de: '',
  description_ru: '',
  description_ckb: '',
  bonus_enabled: false,
  bonus_points: '',
  bonus_percentage: '',
  bonus_mode: 'fixed' as 'fixed' | 'percent',
};

type FormState = typeof EMPTY_FORM;
type ToastState = { message: string; type: 'success' | 'error' };

type GalleryImage = {
  id: string;
  url: string;
  isMain: boolean;
};

type ShadeItem = {
  id: string;
  name: string;
  color_hex: string;
  shade_image: string;
  product_image: string;
  is_available: boolean;
};

function hasMissingTranslation(form: FormState, lang: LangCode): boolean {
  if (lang === 'ar')  return !form.name_ar.trim();
  if (lang === 'en')  return !form.name.trim();
  if (lang === 'es')  return !form.name_es.trim();
  if (lang === 'de')  return !form.name_de.trim();
  if (lang === 'ru')  return !form.name_ru.trim();
  if (lang === 'ckb') return !form.name_ckb.trim();
  return false;
}

function countMissing(form: FormState): number {
  return ['en', 'es', 'de', 'ru', 'ckb'].filter((l) => hasMissingTranslation(form, l as LangCode)).length;
}

const LOW_STOCK_THRESHOLD = 5;

function WebProductsScreen() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const { guard: guardAction } = useActionPermission('manage_products');
  const { admin } = useAdmin();
  const { isSuperAdmin } = usePermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [trashedProducts, setTrashedProducts] = useState<Product[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [dbSubcategories, setDbSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [quickEditStock, setQuickEditStock] = useState<Record<string, string>>({});
  const [savingStock, setSavingStock] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [openingEdit, setOpeningEdit] = useState<string | null>(null);
  const [openEditError, setOpenEditError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [notifyOnCreate, setNotifyOnCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [confirmHardDelete, setConfirmHardDelete] = useState<Product | null>(null);
  const [langTab, setLangTab] = useState<LangCode>('en');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [shades, setShades] = useState<ShadeItem[]>([]);
  const [translating, setTranslating] = useState(false);
  const [overwriteAll, setOverwriteAll] = useState(true);
  // Re-translate modal state (from product list row)
  const [reTranslateProduct, setReTranslateProduct] = useState<Product | null>(null);
  const [reTranslateOverwrite, setReTranslateOverwrite] = useState(true);
  const [reTranslating, setReTranslating] = useState(false);
  const [reTranslateStatus, setReTranslateStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [reTranslateErrorMsg, setReTranslateErrorMsg] = useState<string>('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Google Translate helper (client-side) ───────────────────────────────
  async function gtranslate(text: string, targetLang: string, srcLang = 'ar'): Promise<string> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${srcLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    console.log(`[gtranslate] SRC=${srcLang} TARGET=${targetLang} TEXT="${text.slice(0, 60)}"`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);
    const data = await res.json();
    const raw: string = data?.[0]?.[0]?.[0] ?? '';
    console.log(`[gtranslate] SRC=${srcLang} TARGET=${targetLang} RESULT="${raw.slice(0, 60)}"`);
    if (!raw) throw new Error(`Empty result for ${targetLang}`);
    // Map Google lang codes back to our lang codes for brand normalization
    const ourLang = googleToFormLang(targetLang);
    return normalizeBrandTranslations(raw, ourLang);
  }

  // ── Auto-translate: AR → EN, ES, DE, RU via Google Translate ─────────────
  const handleAutoTranslate = async () => {
    const arName = form.name_ar.trim();
    const arDesc = form.description_ar.trim();
    const arBadge = form.badge_ar.trim();

    if (!arName) {
      showToast('يرجى إدخال النص العربي أولاً', 'error');
      return;
    }

    const targetLangs: LangCode[] = overwriteAll
      ? ['en', 'es', 'de', 'ru', 'ckb']
      : (['en', 'es', 'de', 'ru', 'ckb'] as LangCode[]).filter((l) => {
          if (l === 'en') return !form.name.trim();
          const nameKey = `name_${l}` as keyof FormState;
          return !(form[nameKey] as string)?.trim();
        });

    if (targetLangs.length === 0) {
      showToast('جميع الترجمات موجودة. فعّل "استبدال" لإعادة الترجمة.');
      return;
    }

    console.log('FORM BEFORE TRANSLATION', form);
    setTranslating(true);
    showToast('جاري الترجمة...', 'success');

    // Accumulate all results into a patch, then apply in one setForm call
    const patch: Partial<FormState> = {};
    let failCount = 0;

    // Translate one field across all target langs; errors are non-fatal per lang
    const translateField = async (
      sourceText: string,
      applyResult: (lang: LangCode, translated: string) => void
    ) => {
      await Promise.all(
        targetLangs.map(async (lang) => {
          try {
            const translated = await gtranslate(sourceText, formLangToGoogle(lang));
            applyResult(lang, translated);
          } catch (err) {
            failCount++;
            console.error(`[translate] ${lang} failed:`, err);
          }
        })
      );
    };

    try {
      // name.ar → name.en / name.es / name.de / name.ru
      await translateField(arName, (lang, v) => {
        console.log('TRANSLATED NAME', lang, v);
        if (lang === 'en') patch.name = v;
        else (patch as any)[`name_${lang}`] = v;
      });

      // description.ar → description.en / …
      if (arDesc) {
        await translateField(arDesc, (lang, v) => {
          if (lang === 'en') patch.description = v;
          else (patch as any)[`description_${lang}`] = v;
        });
      }

      // badge.ar → badge (EN only — form has one badge field shared with EN tab)
      if (arBadge) {
        await translateField(arBadge, (lang, v) => {
          if (lang === 'en') patch.badge = v;
        });
      }

      // Single atomic update — avoids stale-closure overwrites
      setForm((f) => {
        const updatedForm = { ...f, ...patch };
        console.log('FORM AFTER TRANSLATION', updatedForm);
        return updatedForm;
      });

      setLangTab('en');

      if (failCount === 0) {
        showToast('تمت الترجمة بنجاح');
      } else if (failCount < targetLangs.length * (arDesc ? (arBadge ? 3 : 2) : 1)) {
        showToast(`تمت الترجمة جزئياً (${failCount} خطأ)`, 'error');
      } else {
        showToast('فشلت الترجمة، حاول مرة أخرى', 'error');
      }
    } catch (err) {
      console.error('[translate] handleAutoTranslate error:', err);
      showToast('فشلت الترجمة، حاول مرة أخرى', 'error');
    } finally {
      setTranslating(false);
    }
  };

  // ── Re-translate from product list: Google Translate → write to DB ────────
  const handleReTranslate = async () => {
    if (!reTranslateProduct) return;
    setReTranslating(true);
    setReTranslateStatus('idle');
    setReTranslateErrorMsg('');
    try {
      // Detect source: prefer Arabic if available, else English
      const srcLang = reTranslateProduct.name_ar?.trim() ? 'ar' : 'en';
      const srcName = srcLang === 'ar' ? (reTranslateProduct.name_ar ?? '') : (reTranslateProduct.name ?? '');
      const srcDesc = srcLang === 'ar' ? (reTranslateProduct.description_ar ?? '') : (reTranslateProduct.description ?? '');
      const fallbackName = reTranslateProduct.name ?? '';
      const fallbackDesc = reTranslateProduct.description ?? '';

      // All target DB languages — use normalized codes (ku not ckb)
      const ALL_TARGET_LANGS = ['en', 'ar', 'es', 'de', 'ru', 'ku'] as const;
      type TargetLang = (typeof ALL_TARGET_LANGS)[number];

      let targetLangs: TargetLang[] = [...ALL_TARGET_LANGS].filter((l) => l !== srcLang);

      if (!reTranslateOverwrite) {
        const { data: existing } = await supabase
          .from('product_translations')
          .select('language, name')
          .eq('product_id', reTranslateProduct.id);
        const existingMap: Record<string, string> = {};
        for (const row of existing ?? []) existingMap[row.language] = row.name ?? '';
        targetLangs = targetLangs.filter((l) => !existingMap[l]?.trim() || existingMap[l].trim() === fallbackName);
      }

      if (targetLangs.length === 0) {
        showToast('All translations already exist. Enable "Overwrite" to regenerate.');
        setReTranslating(false);
        return;
      }

      // Translate each field via Google Translate; fall back to source text on error
      const translated: Record<TargetLang, { name: string; desc: string }> = {} as any;
      await Promise.all(
        targetLangs.map(async (lang) => {
          const googleCode = formLangToGoogle(lang);
          try {
            const [tName, tDesc] = await Promise.all([
              gtranslate(srcName, googleCode, srcLang),
              srcDesc ? gtranslate(srcDesc, googleCode, srcLang) : Promise.resolve(''),
            ]);
            translated[lang] = { name: tName || fallbackName, desc: tDesc || fallbackDesc };
          } catch (err) {
            console.error(`[reTranslate] ${lang} failed:`, err);
            translated[lang] = { name: fallbackName, desc: fallbackDesc };
          }
        })
      );

      // Upsert product_translations rows — always use normalized DB code
      const db = adminSupabase();
      const rows = targetLangs.map((lang) => {
        const { name, desc } = translated[lang];
        const dbLang = normalizeLang(lang);
        console.log('Saving translation', { language: dbLang, name, description: desc });
        return {
          product_id: reTranslateProduct.id,
          language: dbLang,
          name,
          short_description: desc,
          full_description: desc,
          meta_title: name,
          meta_description: desc.slice(0, 160),
        };
      });
      const { error: upsertErr } = await db
        .from('product_translations')
        .upsert(rows, { onConflict: 'product_id,language' });
      if (upsertErr) throw new Error(upsertErr.message);

      // Keep legacy inline columns in sync for ar/es/de
      const legacyUpdate: Record<string, string> = {};
      for (const lang of targetLangs) {
        const { name, desc } = translated[lang as TargetLang] ?? {};
        if (!name) continue;
        if (lang === 'ar') { legacyUpdate.name_ar = name; legacyUpdate.description_ar = desc; }
        if (lang === 'es') { legacyUpdate.name_es = name; legacyUpdate.description_es = desc; }
        if (lang === 'de') { legacyUpdate.name_de = name; legacyUpdate.description_de = desc; }
      }
      if (Object.keys(legacyUpdate).length > 0) {
        await db.from('products').update(legacyUpdate).eq('id', reTranslateProduct.id);
      }

      setReTranslateStatus('done');
      setTimeout(() => { setReTranslateProduct(null); setReTranslateStatus('idle'); }, 2500);
    } catch (err: any) {
      console.error('[reTranslate] error:', err);
      setReTranslateErrorMsg(err?.message ?? 'Unknown error');
      setReTranslateStatus('error');
    } finally {
      setReTranslating(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoadError(null);
    const db = adminSupabase();
    try {
      const [productsRes, trashedRes, catsRes] = await Promise.allSettled([
        db.from('products').select('*').eq('is_deleted', false).order('created_at', { ascending: false }),
        db.from('products').select('*').eq('is_deleted', true).order('deleted_at', { ascending: false }),
        supabase.from('categories').select('*, translation:category_translations!left(*)').eq('active', true).order('sort_order').order('slug'),
      ]);
      if (productsRes.status === 'fulfilled') {
        if (productsRes.value.error) {
          console.error('[AdminProducts] loadAll products error:', productsRes.value.error);
          setLoadError('Failed to load products: ' + productsRes.value.error.message);
        } else {
          setProducts(productsRes.value.data ?? []);
        }
      } else {
        console.error('[AdminProducts] loadAll products rejected:', productsRes.reason);
        setLoadError('Failed to load products. Please refresh.');
      }
      if (trashedRes.status === 'fulfilled') setTrashedProducts(trashedRes.value.data ?? []);
      if (catsRes.status === 'fulfilled') setDbCategories(catsRes.value.data ?? []);
    } catch (err) {
      console.error('[AdminProducts] loadAll unexpected error:', err);
      setLoadError('Unexpected error loading products.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = loadAll;

  // Load subcategories whenever category changes (form open or editing)
  useEffect(() => {
    if (!showForm) return;
    const cat = dbCategories.find((c) => c.slug === form.category);
    if (!cat) { setDbSubcategories([]); return; }
    fetchSubcategories(cat.id, language).then(setDbSubcategories).catch(() => setDbSubcategories([]));
  }, [form.category, showForm]);

  const openAdd = () => {
    setEditProduct(null);
    setForm(EMPTY_FORM);
    setNotifyOnCreate(false);
    setGalleryImages([]);
    setShades([]);
    setLangTab('ar');
    setShowForm(true);
  };

  const openEdit = async (p: Product) => {
    setOpeningEdit(p.id);
    setOpenEditError(null);
    try {
      // Fetch all data in parallel to minimise the async gap
      const [transRes, imgsRes, shadesRes] = await Promise.all([
        supabase
          .from('product_translations')
          .select('language, name, short_description, full_description')
          .eq('product_id', p.id),
        supabase
          .from('product_images')
          .select('*')
          .eq('product_id', p.id)
          .order('sort_order'),
        supabase
          .from('product_shades')
          .select('id, name, color_hex, shade_image, product_image, sort_order, is_available')
          .eq('product_id', p.id)
          .order('sort_order'),
      ]);

      if (transRes.error) console.error('[AdminProducts] openEdit translations error:', transRes.error);
      if (imgsRes.error) console.error('[AdminProducts] openEdit images error:', imgsRes.error);
      if (shadesRes.error) console.error('[AdminProducts] openEdit shades error:', shadesRes.error);

      const transMap: Record<string, { name: string; description: string }> = {};
      for (const row of transRes.data ?? []) {
        transMap[row.language] = {
          name: row.name ?? '',
          description: row.full_description ?? row.short_description ?? '',
        };
      }

      const enName = p.name ?? '';
      const enDesc = p.description ?? '';

      const mapped = (imgsRes.data ?? []).map((img: any) => ({ id: img.id, url: img.url, isMain: img.is_main }));
      if (mapped.length === 0) {
        const fallbackUrl = p.main_image || p.image_url || '';
        if (fallbackUrl) {
          mapped.push({ id: 'legacy-' + Date.now().toString(36), url: fallbackUrl, isMain: true });
        }
      }

      // Apply all state in one batch before opening modal
      setEditProduct(p);
      setLangTab('ar');
      setForm({
        name: enName,
        price: String(p.price ?? ''),
        category: p.category ?? 'accessories',
        try_on_type: (p.try_on_type ?? '') as TryOnTypeOption,
        makeup_subcategory: ((p as any).makeup_subcategory ?? '') as MakeupSubcategory | '',
        subcategory_id: (p as any).subcategory_id ?? '',
        description: enDesc,
        image_url: p.image_url ?? '',
        stock: String(p.stock ?? ''),
        badge: p.badge ?? '',
        badge_ar: (p as any).badge_ar ?? '',
        is_featured: p.is_featured ?? false,
        rating: String(p.rating ?? '4.5'),
        review_count: String(p.review_count ?? '0'),
        name_ar: transMap['ar']?.name ?? p.name_ar ?? '',
        name_es: transMap['es']?.name ?? p.name_es ?? '',
        name_de: transMap['de']?.name ?? p.name_de ?? '',
        name_ru: transMap['ru']?.name ?? '',
        name_ckb: transMap['ku']?.name ?? '',
        description_ar: transMap['ar']?.description ?? p.description_ar ?? '',
        description_es: transMap['es']?.description ?? p.description_es ?? '',
        description_de: transMap['de']?.description ?? p.description_de ?? '',
        description_ru: transMap['ru']?.description ?? '',
        description_ckb: transMap['ku']?.description ?? '',
        bonus_enabled: (p as any).bonus_enabled ?? false,
        bonus_points: String((p as any).bonus_points ?? ''),
        bonus_percentage: String((p as any).bonus_percentage ?? ''),
        bonus_mode: ((p as any).bonus_percentage != null && (p as any).bonus_percentage > 0) ? 'percent' : 'fixed' as 'fixed' | 'percent',
      });
      setGalleryImages(mapped);
      setShades(
        (shadesRes.data ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          color_hex: s.color_hex,
          shade_image: s.shade_image,
          product_image: s.product_image,
          is_available: s.is_available !== false,
        }))
      );
      setShowForm(true);
    } catch (err) {
      console.error('[AdminProducts] openEdit unexpected error:', err);
      setOpenEditError('Failed to load product data. Please try again.');
    } finally {
      setOpeningEdit(null);
    }
  };

  const handleSave = async () => {
    if (!guardAction()) { showToast('Permission denied: manage_products required', 'error'); return; }
    if (!form.name_ar.trim()) { showToast('يرجى إدخال اسم المنتج بالعربية', 'error'); return; }
    if (!form.price || isNaN(Number(form.price))) { showToast('Valid price required', 'error'); return; }
    setSaving(true);

    // AR is source of truth; EN falls back to AR if not translated yet
    const arName = form.name_ar.trim();
    const arDesc = form.description_ar.trim();
    const enName = form.name.trim() || arName;
    const enDesc = form.description.trim() || arDesc;

    // Derive primary image from gallery (first isMain, or first image, or form field)
    const mainGalleryImg = galleryImages.find((g) => g.isMain) ?? galleryImages[0];
    const primaryUrl = mainGalleryImg?.url || form.image_url.trim() || null;
    const galleryUrls = galleryImages.map((g) => g.url);

    // Compute bonus values
    const bonusEnabled = form.bonus_enabled;
    const bonusPoints = form.bonus_mode === 'fixed'
      ? (parseInt(form.bonus_points) || 0)
      : 0;
    const bonusPercentage = form.bonus_mode === 'percent'
      ? (parseFloat(form.bonus_percentage) || null)
      : null;

    const payload = {
      name: enName,
      price: parseFloat(form.price),
      category: form.category,
      try_on_type: form.try_on_type || null,
      makeup_subcategory: form.category === 'makeup' ? (form.makeup_subcategory || null) : null,
      subcategory_id: form.subcategory_id || null,
      description: enDesc,
      image_url: primaryUrl,
      main_image: primaryUrl,
      images: galleryUrls.length > 0 ? galleryUrls : [],
      stock: parseInt(form.stock) || 0,
      badge: form.badge.trim() || null,
      is_featured: form.is_featured,
      rating: parseFloat(form.rating) || 4.5,
      review_count: parseInt(form.review_count) || 0,
      name_ar: arName,
      name_es: form.name_es.trim() || null,
      name_de: form.name_de.trim() || null,
      description_ar: arDesc || null,
      description_es: form.description_es.trim() || null,
      description_de: form.description_de.trim() || null,
      bonus_enabled: bonusEnabled,
      bonus_points: bonusPoints,
      bonus_percentage: bonusPercentage,
    };

    const db = adminSupabase();
    let productId: string;

    if (editProduct) {
      const { error } = await db.from('products').update(payload).eq('id', editProduct.id);
      if (error) { showToast('Save failed: ' + error.message, 'error'); setSaving(false); return; }
      productId = editProduct.id;
    } else {
      const { data: newP, error } = await db.from('products').insert(payload).select().maybeSingle();
      if (error || !newP) { showToast(error ? 'Save failed: ' + error.message : 'Failed to create product', 'error'); setSaving(false); return; }
      productId = newP.id;
    }

    // Persist gallery to product_images table: delete all then re-insert in order
    await db.from('product_images').delete().eq('product_id', productId);
    if (galleryImages.length > 0) {
      const rows = galleryImages.map((img, i) => ({
        product_id: productId,
        url: img.url,
        is_main: img.isMain,
        sort_order: i,
      }));
      await db.from('product_images').insert(rows);
    }

    // Persist shades: delete all then re-insert in order
    await db.from('product_shades').delete().eq('product_id', productId);
    if (shades.length > 0) {
      const shadeRows = shades.map((s, i) => ({
        product_id: productId,
        name: s.name,
        color_hex: s.color_hex,
        shade_image: s.shade_image,
        product_image: s.product_image,
        sort_order: i,
        is_available: s.is_available !== false,
      }));
      await db.from('product_shades').insert(shadeRows);
    }

    // Upsert product_translations — AR is source of truth, others fall back to AR
    // Note: 'ckb' is the form key for Kurdish; DB stores 'ku' — always normalize before save
    const transRows: { formLang: LangCode; name: string; description: string }[] = [
      { formLang: 'ar',  name: arName, description: arDesc || enDesc },
      { formLang: 'en',  name: enName, description: enDesc },
      { formLang: 'es',  name: form.name_es.trim()  || arName, description: form.description_es.trim()  || arDesc || enDesc },
      { formLang: 'de',  name: form.name_de.trim()  || arName, description: form.description_de.trim()  || arDesc || enDesc },
      { formLang: 'ru',  name: form.name_ru.trim()  || arName, description: form.description_ru.trim()  || arDesc || enDesc },
      { formLang: 'ckb', name: form.name_ckb.trim() || arName, description: form.description_ckb.trim() || arDesc || enDesc },
    ];

    await Promise.all(
      transRows.map(({ formLang, name, description }) => {
        const dbLang = formLangToDb(formLang);
        console.log('Saving translation', { language: dbLang, name, description });
        return db.from('product_translations').upsert(
          {
            product_id: productId,
            language: dbLang,
            name,
            short_description: description,
            full_description: description,
            meta_title: name,
            meta_description: description.slice(0, 160),
          },
          { onConflict: 'product_id,language' }
        );
      })
    );

    // Auto-notify customers on new product creation if checkbox was checked
    if (!editProduct && notifyOnCreate) {
      const productName = form.name_ar || form.name || 'New Product';
      adminSendNotification({
        title: `New product: ${productName}`,
        message: form.description_ar || form.description || `Check out our new product: ${productName}`,
        type: 'new_product',
        channels: ['app'],
        target: 'all',
      }).catch((e) => console.warn('[products] notify failed:', e));
    }

    await fetchProducts();
    setSaving(false);
    setShowForm(false);
    showToast(editProduct ? 'Product updated' : 'Product created');
    logAdminAction({ action: editProduct ? 'update' : 'create', entityType: 'product', entityId: editProduct?.id, entityLabel: form.name_ar || form.name, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
  };

  const handleDelete = async (p: Product) => {
    if (!guardAction()) { showToast('Permission denied: manage_products required', 'error'); return; }
    setDeleting(p.id);
    await adminSupabase().from('products').update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: admin?.email ?? '',
    }).eq('id', p.id);
    await fetchProducts();
    setDeleting(null);
    setConfirmDelete(null);
    showToast('Product moved to trash');
    logAdminAction({ action: 'delete', entityType: 'product', entityId: p.id, entityLabel: p.name, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
  };

  const handleRestore = async (p: Product) => {
    await adminSupabase().from('products').update({
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
    }).eq('id', p.id);
    await fetchProducts();
    showToast('Product restored');
    logAdminAction({ action: 'update', entityType: 'product', entityId: p.id, entityLabel: p.name, metadata: { action: 'restore' }, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
  };

  const handleHardDelete = async (p: Product) => {
    setDeleting(p.id);
    await adminSupabase().from('products').delete().eq('id', p.id);
    await fetchProducts();
    setDeleting(null);
    setConfirmHardDelete(null);
    showToast('Product permanently deleted');
    logAdminAction({ action: 'delete', entityType: 'product', entityId: p.id, entityLabel: p.name, metadata: { permanent: true }, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
  };

  const handleQuickStockSave = async (productId: string) => {
    if (!guardAction()) { showToast('Permission denied: manage_products required', 'error'); return; }
    const rawVal = quickEditStock[productId];
    const newStock = parseInt(rawVal ?? '', 10);
    if (isNaN(newStock) || newStock < 0) {
      showToast('أدخل كمية صحيحة', 'error');
      return;
    }
    setSavingStock(productId);
    const { error } = await adminSupabase().from('products').update({ stock: newStock }).eq('id', productId);
    setSavingStock(null);
    if (error) {
      showToast('فشل الحفظ: ' + error.message, 'error');
    } else {
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, stock: newStock } : p));
      setQuickEditStock((prev) => { const n = { ...prev }; delete n[productId]; return n; });
      showToast('تم تحديث المخزون');
    }
  };

  const toggleInStock = async (productId: string, current: boolean) => {
    if (!guardAction()) { showToast('Permission denied: manage_products required', 'error'); return; }
    const next = !current;
    const token = getAdminToken();
    console.log('[toggleInStock] admin token present:', !!token, '| productId:', productId, '| setting in_stock →', next);

    const { error, count } = await adminSupabase()
      .from('products')
      .update({ in_stock: next }, { count: 'exact' })
      .eq('id', productId);

    console.log('[toggleInStock] result — error:', error, '| rows updated:', count);

    if (error) {
      showToast('Failed to update availability: ' + error.message, 'error');
      return;
    }
    if (count === 0) {
      // RLS blocked the update silently — no error but 0 rows affected
      showToast('Update blocked: insufficient permissions or invalid session. Please re-login as admin.', 'error');
      return;
    }
    // Only update UI after confirmed DB success
    setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, in_stock: next } : p));
    showToast(next ? 'Product marked as Available' : 'Product marked as Out of Stock');
  };

  const allCategories = dbCategories.length > 0
    ? dbCategories.map((c) => ({
        slug: c.slug,
        label: (Array.isArray(c.translation) ? c.translation.find((tr: any) => tr.language === 'en') : c.translation)?.name || c.slug,
      }))
    : FALLBACK_CATEGORIES.map((c) => ({ slug: c, label: c }));

  const sourceProducts = showTrash ? trashedProducts : products;
  const filtered = sourceProducts.filter((p) => {
    if (showTrash) {
      const q = search.trim().toLowerCase();
      return q === '' || (p.name ?? '').toLowerCase().includes(q) || (p.name_ar ?? '').toLowerCase().includes(q);
    }
    const q = search.trim().toLowerCase();
    const matchSearch =
      q === '' ||
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q);
    const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const lowStockCount = products.filter((p) => (p.stock ?? 0) <= LOW_STOCK_THRESHOLD).length;

  return (
    <View style={styles.container}>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <View style={styles.topRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={Colors.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={showTrash ? 'Search trash...' : t.searchProducts}
            placeholderTextColor={Colors.textMuted}
          />
          {search !== '' && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
        {isSuperAdmin && (
          <TouchableOpacity
            style={[styles.trashToggleBtn, showTrash && styles.trashToggleBtnActive]}
            onPress={() => { setShowTrash(!showTrash); setSearch(''); setCategoryFilter('all'); }}
            activeOpacity={0.8}
          >
            <Trash2 size={14} color={showTrash ? Colors.error : Colors.textMuted} strokeWidth={2} />
            <Text style={[styles.trashToggleText, showTrash && { color: Colors.error }]}>
              Trash {trashedProducts.length > 0 ? `(${trashedProducts.length})` : ''}
            </Text>
          </TouchableOpacity>
        )}
        {!showTrash && (
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
            <Plus size={18} color={Colors.background} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>{t.addProduct}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Low stock alert — hidden in trash view */}
      {!showTrash && lowStockCount > 0 && (
        <View style={styles.lowStockBanner}>
          <AlertCircle size={15} color={Colors.warning} strokeWidth={2} />
          <Text style={styles.lowStockBannerText}>
            {lowStockCount} منتج بمخزون منخفض (≤ {LOW_STOCK_THRESHOLD})
          </Text>
        </View>
      )}

      {/* Category filter — hidden in trash view */}
      {!showTrash && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }} contentContainerStyle={{ gap: Spacing.sm, paddingRight: Spacing.sm }}>
          {[{ slug: 'all', label: 'الكل' }, ...allCategories].map(({ slug, label }) => (
            <TouchableOpacity
              key={slug}
              style={[styles.catFilterChip, categoryFilter === slug && styles.catFilterChipActive]}
              onPress={() => setCategoryFilter(slug)}
              activeOpacity={0.7}
            >
              <Text style={[styles.catFilterChipText, categoryFilter === slug && styles.catFilterChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {openEditError && (
        <View style={styles.errorBanner}>
          <AlertCircle size={16} color={Colors.error} strokeWidth={2} />
          <Text style={styles.errorBannerText}>{openEditError}</Text>
          <TouchableOpacity onPress={() => setOpenEditError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={14} color={Colors.error} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.neonBlue} size="large" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.errorState}>
          <AlertCircle size={32} color={Colors.error} strokeWidth={1.5} />
          <Text style={styles.errorStateText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadAll} activeOpacity={0.8}>
            <RefreshCw size={15} color={Colors.background} strokeWidth={2} />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.emptyText}>{showTrash ? 'Trash is empty' : t.noProductsFound}</Text>
      ) : (
        filtered.map((p) => {
          const isLowStock = !showTrash && (p.stock ?? 0) <= LOW_STOCK_THRESHOLD;
          const stockEditing = !showTrash && quickEditStock[p.id] !== undefined;
          return (
            <View key={p.id} style={[styles.productCard, isLowStock && styles.productCardLowStock]}>
              <View style={styles.productThumb}>
                {p.image_url ? (
                  <OptimizedImage source={{ uri: p.image_url }} displayWidth={52} style={styles.thumbImg} resizeMode="cover" />
                ) : (
                  <Package size={24} color={Colors.textMuted} strokeWidth={1.5} />
                )}
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>{getProductName(p, language)}</Text>
                <View style={styles.productMetaRow}>
                  <Text style={styles.productMeta}>{p.category} · {formatPrice(p.price, language)}</Text>
                  {(p as any).makeup_subcategory && (
                    <View style={styles.makeupSubBadge}>
                      <Text style={styles.makeupSubBadgeText}>{(p as any).makeup_subcategory}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.stockRow}>
                  {isLowStock && (
                    <View style={styles.lowStockBadge}>
                      <AlertCircle size={10} color={Colors.warning} strokeWidth={2.5} />
                      <Text style={styles.lowStockBadgeText}>مخزون منخفض</Text>
                    </View>
                  )}
                  {stockEditing ? (
                    <View style={styles.quickStockRow}>
                      <TextInput
                        style={styles.quickStockInput}
                        value={quickEditStock[p.id]}
                        onChangeText={(v) => setQuickEditStock((prev) => ({ ...prev, [p.id]: v }))}
                        keyboardType="number-pad"
                        autoFocus
                        selectTextOnFocus
                        placeholderTextColor={Colors.textMuted}
                      />
                      <TouchableOpacity
                        style={styles.quickStockSave}
                        onPress={() => handleQuickStockSave(p.id)}
                        activeOpacity={0.8}
                        disabled={savingStock === p.id}
                      >
                        {savingStock === p.id
                          ? <ActivityIndicator size="small" color={Colors.background} />
                          : <Text style={styles.quickStockSaveText}>حفظ</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickStockCancel}
                        onPress={() => setQuickEditStock((prev) => { const n = { ...prev }; delete n[p.id]; return n; })}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <X size={13} color={Colors.textMuted} strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setQuickEditStock((prev) => ({ ...prev, [p.id]: String(p.stock ?? 0) }))}
                      activeOpacity={0.7}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Text style={[styles.productStock, isLowStock && { color: Colors.warning }]}>
                        المخزون: {p.stock}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <View style={styles.productActions}>
                {showTrash ? (
                  <>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Colors.success + '18' }]}
                      onPress={() => handleRestore(p)}
                      activeOpacity={0.7}
                    >
                      <RotateCcw size={16} color={Colors.success} strokeWidth={2} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Colors.error + '18' }]}
                      onPress={() => setConfirmHardDelete(p)}
                      activeOpacity={0.7}
                    >
                      {deleting === p.id ? (
                        <ActivityIndicator size="small" color={Colors.error} />
                      ) : (
                        <Trash2 size={16} color={Colors.error} strokeWidth={2} />
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {/* Availability toggle */}
                    <TouchableOpacity
                      style={[
                        styles.availabilityBtn,
                        p.in_stock !== false ? styles.availabilityBtnIn : styles.availabilityBtnOut,
                      ]}
                      onPress={() => toggleInStock(p.id, p.in_stock !== false)}
                      activeOpacity={0.75}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Text style={[
                        styles.availabilityBtnText,
                        p.in_stock !== false ? styles.availabilityBtnTextIn : styles.availabilityBtnTextOut,
                      ]}>
                        {p.in_stock !== false ? 'In Stock' : 'OOS'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, openingEdit === p.id && { opacity: 0.6 }]}
                      onPress={() => { if (!openingEdit) openEdit(p); }}
                      activeOpacity={0.7}
                      disabled={!!openingEdit}
                    >
                      {openingEdit === p.id
                        ? <ActivityIndicator size="small" color={Colors.neonBlue} />
                        : <Pencil size={16} color={Colors.neonBlue} strokeWidth={2} />
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: 'rgba(255,77,141,0.08)', borderColor: 'rgba(255,77,141,0.25)' }]}
                      onPress={() => { setReTranslateProduct(p); setReTranslateOverwrite(true); setReTranslateStatus('idle'); setReTranslateErrorMsg(''); }}
                      activeOpacity={0.7}
                    >
                      <RefreshCw size={15} color={Colors.neonBlue} strokeWidth={2} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Colors.error + '18' }]}
                      onPress={() => setConfirmDelete(p)}
                      activeOpacity={0.7}
                    >
                      {deleting === p.id ? (
                        <ActivityIndicator size="small" color={Colors.error} />
                      ) : (
                        <Trash2 size={16} color={Colors.error} strokeWidth={2} />
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        })
      )}

      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editProduct ? t.editProduct : t.addProduct}</Text>
            <TouchableOpacity onPress={() => setShowForm(false)} activeOpacity={0.7}>
              <X size={22} color={Colors.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Primary language label */}
            <View style={styles.primaryLangBanner}>
              <Star size={12} color={Colors.gold} fill={Colors.gold} strokeWidth={0} />
              <Text style={styles.primaryLangLabel}>العربية هي اللغة الأساسية</Text>
            </View>
            <View style={styles.langTabs}>
              {LANG_TABS.map((l) => {
                const missing = hasMissingTranslation(form, l.code);
                const isPrimary = l.code === 'ar';
                return (
                  <TouchableOpacity
                    key={l.code}
                    style={[styles.langTab, langTab === l.code && styles.langTabActive, isPrimary && styles.langTabPrimary]}
                    onPress={() => setLangTab(l.code)}
                    activeOpacity={0.7}
                  >
                    {isPrimary ? (
                      <Star size={11} color={langTab === 'ar' ? Colors.gold : Colors.warning} fill={langTab === 'ar' ? Colors.gold : Colors.warning} strokeWidth={0} />
                    ) : missing ? (
                      <AlertCircle size={12} color={Colors.warning} strokeWidth={2} />
                    ) : (
                      <CheckCircle size={12} color={Colors.success} strokeWidth={2} />
                    )}
                    <Text style={[styles.langTabText, langTab === l.code && styles.langTabTextActive]}>{l.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {langTab === 'en' && (
              <>
                <FormField label="Name (English)" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Product name" />
                <FormField label="Description (English)" value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} placeholder="Description" multiline />
                <FormField label="Badge" value={form.badge} onChangeText={(v) => setForm((f) => ({ ...f, badge: v }))} placeholder={t.badgePlaceholder} />
                <Text style={styles.fieldLabel}>Virtual Try-On Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    {TRYON_TYPE_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt === '' ? '__none__' : opt}
                        style={[styles.catChip, form.try_on_type === opt && styles.catChipActive]}
                        onPress={() => setForm((f) => ({ ...f, try_on_type: opt }))}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.catChipText, form.try_on_type === opt && styles.catChipTextActive]}>
                          {opt === '' ? 'None' : opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
            {langTab === 'ar' && (
              <>
                <View style={styles.arPrimaryNote}>
                  <Text style={styles.arPrimaryNoteText}>أدخل المعلومات الأساسية للمنتج بالعربية. يمكنك بعد ذلك الترجمة لباقي اللغات.</Text>
                </View>
                <FormField label="اسم المنتج *" value={form.name_ar} onChangeText={(v) => setForm((f) => ({ ...f, name_ar: v }))} placeholder="اسم المنتج بالعربية" rtl />
                <FormField label="الوصف" value={form.description_ar} onChangeText={(v) => setForm((f) => ({ ...f, description_ar: v }))} placeholder="وصف المنتج" multiline rtl />
                <FormField label="الشارة / Badge (اختياري)" value={form.badge_ar} onChangeText={(v) => setForm((f) => ({ ...f, badge_ar: v }))} placeholder="مثال: جديد، الأكثر مبيعاً" rtl />

                {/* Price / Stock / Category on AR tab for convenience */}
                <FormField label="Price *" value={form.price} onChangeText={(v) => setForm((f) => ({ ...f, price: v }))} placeholder={t.pricePlaceholder} keyboardType="decimal-pad" />
                <FormField label="Stock" value={form.stock} onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))} placeholder={t.stockPlaceholder} keyboardType="number-pad" />
                <Text style={styles.fieldLabel}>{t.categoryField}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                    {(dbCategories.length > 0
                      ? dbCategories.map((c) => ({
                          slug: c.slug,
                          label: (Array.isArray(c.translation) ? c.translation.find((tr: any) => tr.language === 'en') : c.translation)?.name || c.slug,
                        }))
                      : FALLBACK_CATEGORIES.map((c) => ({ slug: c, label: c }))
                    ).map(({ slug, label }) => (
                      <TouchableOpacity
                        key={slug}
                        style={[styles.catChip, form.category === slug && styles.catChipActive]}
                        onPress={() => setForm((f) => ({ ...f, category: slug, makeup_subcategory: slug === 'makeup' ? f.makeup_subcategory : '', subcategory_id: '' }))}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.catChipText, form.category === slug && styles.catChipTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {form.category === 'makeup' && (
                  <>
                    <Text style={styles.fieldLabel}>Makeup Type *</Text>
                    <View style={styles.makeupSubRow}>
                      {MAKEUP_SUBCATEGORIES.map(({ value, label }) => (
                        <TouchableOpacity
                          key={value}
                          style={[styles.makeupSubChip, form.makeup_subcategory === value && styles.makeupSubChipActive]}
                          onPress={() => setForm((f) => ({ ...f, makeup_subcategory: value }))}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.makeupSubChipText, form.makeup_subcategory === value && styles.makeupSubChipTextActive]}>
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                {dbSubcategories.length > 0 && (
                  <>
                    <Text style={styles.fieldLabel}>{(t as any).subcategoryLabel ?? 'Subcategory'}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
                      <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                        <TouchableOpacity
                          key="__none__"
                          style={[styles.catChip, !form.subcategory_id && styles.subCatChipNone]}
                          onPress={() => setForm((f) => ({ ...f, subcategory_id: '' }))}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.catChipText, !form.subcategory_id && styles.subCatChipNoneText]}>
                            {(t as any).noSubcategoryOption ?? 'None'}
                          </Text>
                        </TouchableOpacity>
                        {dbSubcategories.map((sub) => {
                          const subLabel = getSubcategoryName(sub, language);
                          return (
                            <TouchableOpacity
                              key={sub.id}
                              style={[styles.catChip, form.subcategory_id === sub.id && styles.catChipActive]}
                              onPress={() => setForm((f) => ({ ...f, subcategory_id: sub.id }))}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.catChipText, form.subcategory_id === sub.id && styles.catChipTextActive]}>
                                {subLabel}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </>
                )}
                <View style={styles.switchRow}>
                  <Text style={styles.fieldLabel}>{t.featuredField}</Text>
                  <Switch
                    value={form.is_featured}
                    onValueChange={(v) => setForm((f) => ({ ...f, is_featured: v }))}
                    thumbColor={form.is_featured ? Colors.neonBlue : Colors.textMuted}
                    trackColor={{ false: Colors.border, true: Colors.neonBlueBorder }}
                  />
                </View>

                {/* ── Bonus Points Section ── */}
                <View style={styles.bonusSection}>
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>{(t as any).loyaltyBonusEnabled ?? 'Enable Bonus Points'}</Text>
                      <Text style={[styles.bonusSectionSub]}>Customers earn points after this order is completed</Text>
                    </View>
                    <Switch
                      value={form.bonus_enabled}
                      onValueChange={(v) => setForm((f) => ({ ...f, bonus_enabled: v }))}
                      thumbColor={form.bonus_enabled ? Colors.gold : Colors.textMuted}
                      trackColor={{ false: Colors.border, true: Colors.gold + '50' }}
                    />
                  </View>
                  {form.bonus_enabled && (
                    <>
                      <Text style={styles.fieldLabel}>{(t as any).loyaltyBonusMode ?? 'Bonus Mode'}</Text>
                      <View style={styles.bonusModeRow}>
                        <TouchableOpacity
                          style={[styles.bonusModeBtn, form.bonus_mode === 'fixed' && styles.bonusModeBtnActive]}
                          onPress={() => setForm((f) => ({ ...f, bonus_mode: 'fixed' }))}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.bonusModeBtnText, form.bonus_mode === 'fixed' && styles.bonusModeBtnTextActive]}>
                            {(t as any).loyaltyBonusModeFixed ?? 'Fixed Points'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.bonusModeBtn, form.bonus_mode === 'percent' && styles.bonusModeBtnActive]}
                          onPress={() => setForm((f) => ({ ...f, bonus_mode: 'percent' }))}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.bonusModeBtnText, form.bonus_mode === 'percent' && styles.bonusModeBtnTextActive]}>
                            {(t as any).loyaltyBonusModePercent ?? 'Percentage'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {form.bonus_mode === 'fixed' ? (
                        <FormField
                          label={(t as any).loyaltyBonusPoints ?? 'Bonus Points'}
                          value={form.bonus_points}
                          onChangeText={(v) => setForm((f) => ({ ...f, bonus_points: v }))}
                          placeholder="e.g. 500"
                          keyboardType="number-pad"
                        />
                      ) : (
                        <FormField
                          label={(t as any).loyaltyBonusPercentage ?? 'Bonus Percentage (%)'}
                          value={form.bonus_percentage}
                          onChangeText={(v) => setForm((f) => ({ ...f, bonus_percentage: v }))}
                          placeholder="e.g. 5"
                          keyboardType="decimal-pad"
                        />
                      )}
                      <View style={styles.bonusPreview}>
                        <Text style={styles.bonusPreviewText}>
                          Preview:{' '}
                          {form.bonus_mode === 'fixed'
                            ? `Customer earns ${parseInt(form.bonus_points) || 0} pts`
                            : form.price
                            ? `Customer earns ${Math.floor(parseFloat(form.price) * (parseFloat(form.bonus_percentage) || 0) / 100)} pts (${form.bonus_percentage || 0}% of ${form.price} IQD)`
                            : 'Enter price to preview'
                          }
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {!editProduct && (
                  <TouchableOpacity
                    style={styles.notifyRow}
                    onPress={() => setNotifyOnCreate((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.notifyCheckbox, notifyOnCreate && styles.notifyCheckboxOn]}>
                      {notifyOnCreate && <Text style={styles.notifyCheckmark}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifyLabel}>Notify customers</Text>
                      <Text style={styles.notifySub}>Send in-app notification when product is created</Text>
                    </View>
                  </TouchableOpacity>
                )}
                <Text style={styles.fieldLabel}>{t.mainImage}</Text>
                <ImageUploader
                  value={form.image_url}
                  onChange={(url) => {
                    setForm((f) => ({ ...f, image_url: url }));
                    if (url && galleryImages.length === 0) {
                      setGalleryImages([{ id: 'main-' + Date.now().toString(36), url, isMain: true }]);
                    }
                  }}
                  folder="products"
                />
                <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>{t.imageGallery}</Text>
                <ProductImageGallery
                  images={galleryImages}
                  onChange={(imgs) => {
                    setGalleryImages(imgs);
                    const main = imgs.find((g) => g.isMain) ?? imgs[0];
                    if (main) setForm((f) => ({ ...f, image_url: main.url }));
                  }}
                />
                <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>Shades / Colors</Text>
                <ShadeManager shades={shades} onChange={setShades} />
              </>
            )}
            {langTab === 'es' && (
              <>
                <FormField label={t.nameSpanish} value={form.name_es} onChangeText={(v) => setForm((f) => ({ ...f, name_es: v }))} placeholder="Nombre del producto" />
                <FormField label={t.descSpanish} value={form.description_es} onChangeText={(v) => setForm((f) => ({ ...f, description_es: v }))} placeholder="Descripción" multiline />
              </>
            )}
            {langTab === 'de' && (
              <>
                <FormField label={t.nameGerman} value={form.name_de} onChangeText={(v) => setForm((f) => ({ ...f, name_de: v }))} placeholder="Produktname" />
                <FormField label={t.descGerman} value={form.description_de} onChangeText={(v) => setForm((f) => ({ ...f, description_de: v }))} placeholder="Beschreibung" multiline />
              </>
            )}
            {langTab === 'ru' && (
              <>
                <FormField label={t.nameRussian} value={form.name_ru} onChangeText={(v) => setForm((f) => ({ ...f, name_ru: v }))} placeholder="Название товара" />
                <FormField label={t.descRussian} value={form.description_ru} onChangeText={(v) => setForm((f) => ({ ...f, description_ru: v }))} placeholder="Описание" multiline />
              </>
            )}
            {langTab === 'ckb' && (
              <>
                <FormField label="ناوی بەرهەم (کوردی)" value={form.name_ckb} onChangeText={(v) => setForm((f) => ({ ...f, name_ckb: v }))} placeholder="ناوی بەرهەم" rtl />
                <FormField label="وەسف (کوردی)" value={form.description_ckb} onChangeText={(v) => setForm((f) => ({ ...f, description_ckb: v }))} placeholder="وەسفی بەرهەم" multiline rtl />
              </>
            )}
            {/* Overwrite checkbox for auto-translate */}
            <TouchableOpacity
              style={styles.overwriteRow}
              onPress={() => setOverwriteAll((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, overwriteAll && styles.checkboxChecked]}>
                {overwriteAll && <CheckCircle size={12} color={Colors.background} strokeWidth={3} />}
              </View>
              <Text style={styles.overwriteLabel}>استبدال الترجمات الموجودة</Text>
            </TouchableOpacity>
            <View style={{ height: 24 }} />
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.translateBtn, translating && { opacity: 0.6 }]}
              onPress={handleAutoTranslate}
              activeOpacity={0.8}
              disabled={translating || saving}
            >
              {translating
                ? <ActivityIndicator color={Colors.neonBlue} size="small" />
                : <><Globe size={15} color={Colors.neonBlue} strokeWidth={2} /><Text style={styles.translateBtnText}>ترجمة لباقي اللغات</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8} disabled={saving || translating}>
              {saving ? <ActivityIndicator color={Colors.background} size="small" /> : <Text style={styles.saveBtnText}>{t.save}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!confirmDelete} animationType="fade" transparent onRequestClose={() => setConfirmDelete(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>{t.deleteProduct}</Text>
            <Text style={styles.confirmMsg} numberOfLines={2}>{confirmDelete?.name_ar || confirmDelete?.name}</Text>
            <Text style={[styles.confirmMsg, { fontSize: FontSize.xs, color: Colors.warning, marginTop: 4 }]}>
              Product will be moved to trash. Super admins can restore it.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmDelete(null)} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: Colors.error }]}
                onPress={() => confirmDelete && handleDelete(confirmDelete)}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>{t.delete}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!confirmHardDelete} animationType="fade" transparent onRequestClose={() => setConfirmHardDelete(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Permanently Delete?</Text>
            <Text style={styles.confirmMsg} numberOfLines={2}>{confirmHardDelete?.name_ar || confirmHardDelete?.name}</Text>
            <Text style={[styles.confirmMsg, { fontSize: FontSize.xs, color: Colors.error, marginTop: 4 }]}>
              This cannot be undone.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmHardDelete(null)} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: Colors.error }]}
                onPress={() => confirmHardDelete && handleHardDelete(confirmHardDelete)}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>Delete Permanently</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Re-Translate modal */}
      <Modal
        visible={!!reTranslateProduct}
        animationType="fade"
        transparent
        onRequestClose={() => !reTranslating && setReTranslateProduct(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.reTranslateBox}>
            {/* Header */}
            <View style={styles.reTranslateHeader}>
              <View style={styles.reTranslateIconWrap}>
                <Globe size={20} color={Colors.neonBlue} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reTranslateTitle}>{t.reTranslate ?? 'Re-Translate'}</Text>
                <Text style={styles.reTranslateProduct} numberOfLines={1}>{reTranslateProduct?.name}</Text>
              </View>
              {!reTranslating && (
                <TouchableOpacity onPress={() => setReTranslateProduct(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={18} color={Colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>

            {/* Info */}
            <Text style={styles.reTranslateDesc}>
              {reTranslateProduct?.name_ar?.trim()
                ? 'Translate Arabic text into EN, ES, DE, RU, and Kurdish using Google Translate.'
                : 'Translate English text into AR, ES, DE, RU, and Kurdish using Google Translate.'}
            </Text>

            {/* Overwrite checkbox */}
            <TouchableOpacity
              style={styles.overwriteRow}
              onPress={() => !reTranslating && setReTranslateOverwrite((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, reTranslateOverwrite && styles.checkboxChecked]}>
                {reTranslateOverwrite && <CheckCircle size={12} color={Colors.background} strokeWidth={3} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.overwriteLabel}>{t.overwriteTranslations ?? 'Overwrite existing translations'}</Text>
                <Text style={styles.overwriteHint}>
                  {reTranslateOverwrite
                    ? 'All 5 languages will be regenerated'
                    : (t.overwriteOffDesc ?? 'Only missing or English-fallback translations will be filled')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Target languages indicator */}
            <View style={styles.langChips}>
              {(['AR', 'EN', 'ES', 'DE', 'RU', 'KU'] as const).map((l) => (
                <View key={l} style={styles.langChip}>
                  <Text style={styles.langChipText}>{l}</Text>
                </View>
              ))}
            </View>

            {/* Status message */}
            {reTranslateStatus === 'done' && (
              <View style={styles.statusSuccess}>
                <CheckCircle size={16} color={Colors.success} strokeWidth={2.5} />
                <Text style={styles.statusSuccessText}>{t.translationsUpdated ?? 'Translations updated successfully'}</Text>
              </View>
            )}
            {reTranslateStatus === 'error' && (
              <View style={styles.statusError}>
                <AlertCircle size={16} color={Colors.error} strokeWidth={2} />
                <Text style={styles.statusErrorText}>
                  {reTranslateErrorMsg
                    ? `Translation failed: ${reTranslateErrorMsg}`
                    : (t.translationFailed ?? 'Translation failed. Please try again.')}
                </Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.reTranslateBtns}>
              <TouchableOpacity
                style={[styles.cancelBtn, { flex: 0, paddingHorizontal: Spacing.lg }]}
                onPress={() => setReTranslateProduct(null)}
                disabled={reTranslating}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reTranslateRunBtn, reTranslating && { opacity: 0.7 }]}
                onPress={handleReTranslate}
                disabled={reTranslating}
                activeOpacity={0.8}
              >
                {reTranslating ? (
                  <>
                    <ActivityIndicator color={Colors.background} size="small" />
                    <Text style={styles.saveBtnText}>{t.translating ?? 'Translating...'}</Text>
                  </>
                ) : (
                  <>
                    <RefreshCw size={15} color={Colors.background} strokeWidth={2.5} />
                    <Text style={styles.saveBtnText}>{t.reTranslate ?? 'Re-Translate'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MobileProductsScreen() {
  const { t, language } = useLanguage();
  const { guard: guardAction } = useActionPermission('manage_products');
  const { admin } = useAdmin();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', price: '', stock: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, stock, category, image_url, is_featured, rating, review_count')
      .order('created_at', { ascending: false });
    if (error) console.error('fetchProducts error:', error);
    setProducts(data ?? []);
    setLoading(false);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({
      name: p.name ?? '',
      price: String(p.price ?? ''),
      stock: String(p.stock ?? ''),
    });
  };

  const handleSave = async () => {
    if (!guardAction()) { showToast('Permission denied: manage_products required', 'error'); return; }
    if (!editProduct) return;
    if (!editForm.name.trim()) { showToast('Product name is required', 'error'); return; }
    const price = parseFloat(editForm.price);
    if (isNaN(price) || price < 0) { showToast('Enter a valid price', 'error'); return; }
    setSaving(true);
    const { error } = await adminSupabase()
      .from('products')
      .update({
        name: editForm.name.trim(),
        price,
        stock: parseInt(editForm.stock) || 0,
      })
      .eq('id', editProduct.id);
    setSaving(false);
    if (error) {
      console.error('Product update failed:', error.message, error);
      showToast('Save failed: ' + error.message, 'error');
      return;
    }
    await fetchProducts();
    showToast('Product saved');
    setTimeout(() => setEditProduct(null), 400);
    logAdminAction({ action: 'update', entityType: 'product', entityId: editProduct.id, entityLabel: editForm.name.trim(), adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
  };

  const filtered = products.filter(
    (p) =>
      search.trim() === '' ||
      (p.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (editProduct) {
    return (
      <View style={styles.detailContainer}>
        {toast && <Toast message={toast.message} type={toast.type} />}
        <TouchableOpacity style={styles.backRow} onPress={() => setEditProduct(null)} activeOpacity={0.7}>
          <Text style={styles.backLink}>{t.backToProducts}</Text>
        </TouchableOpacity>

        <View style={styles.editCard}>
          <Text style={styles.editCardTitle}>{t.editProduct}</Text>
          <Text style={styles.editCardSub} numberOfLines={1}>{editProduct.name}</Text>

          <View style={styles.editField}>
            <Text style={styles.fieldLabel}>{t.productNameField}</Text>
            <TextInput
              style={styles.fieldInput}
              value={editForm.name}
              onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))}
              placeholder="Product name"
              placeholderTextColor={Colors.textMuted}
              autoCorrect={false}
            />
          </View>

          <View style={styles.editField}>
            <Text style={styles.fieldLabel}>{t.priceField}</Text>
            <TextInput
              style={styles.fieldInput}
              value={editForm.price}
              onChangeText={(v) => setEditForm((f) => ({ ...f, price: v }))}
              placeholder={t.pricePlaceholder}
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.editField}>
            <Text style={styles.fieldLabel}>{t.stockField}</Text>
            <TextInput
              style={styles.fieldInput}
              value={editForm.stock}
              onChangeText={(v) => setEditForm((f) => ({ ...f, stock: v }))}
              placeholder={t.stockPlaceholder}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={Colors.background} size="small" />
            ) : (
              <Text style={styles.saveBtnText}>{t.saveChanges2}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.searchBox}>
        <Search size={16} color={Colors.textMuted} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t.searchProducts}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search !== '' && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={16} color={Colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.neonBlue} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <Text style={styles.emptyText}>{t.noProductsFound}</Text>
      ) : (
        filtered.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.mobileProductCard}
            onPress={() => openEdit(p)}
            activeOpacity={0.8}
          >
            <View style={styles.productThumb}>
              {p.image_url ? (
                <Image source={{ uri: p.image_url }} style={styles.thumbImg} resizeMode="cover" />
              ) : (
                <Package size={22} color={Colors.textMuted} strokeWidth={1.5} />
              )}
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.productMeta}>{p.category}</Text>
              <Text style={styles.productStock}>{formatPrice(p.price, language)} · Stock: {p.stock}</Text>
            </View>
            <Pencil size={16} color={Colors.neonBlue} strokeWidth={2} />
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function ShadeManager({ shades, onChange }: { shades: ShadeItem[]; onChange: (s: ShadeItem[]) => void }) {
  const [extracting, setExtracting] = useState<Record<string, boolean>>({});

  const addShade = () => {
    onChange([...shades, {
      id: 'new-' + Date.now().toString(36),
      name: '',
      color_hex: '#CC6677',
      shade_image: '',
      product_image: '',
      is_available: true,
    }]);
  };

  const updateShade = (id: string, field: keyof ShadeItem, value: string | boolean) => {
    onChange(shades.map((s) => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleShadeImageChange = async (id: string, url: string) => {
    updateShade(id, 'shade_image', url);
    if (!url || Platform.OS !== 'web') return;
    setExtracting((prev) => ({ ...prev, [id]: true }));
    const hex = await extractDominantColor(url);
    setExtracting((prev) => ({ ...prev, [id]: false }));
    if (hex) {
      onChange(shades.map((s) => {
        if (s.id !== id) return s;
        return { ...s, shade_image: url, color_hex: hex };
      }));
    }
  };

  const handleProductImageExtract = async (id: string) => {
    const shade = shades.find((s) => s.id === id);
    const url = shade?.product_image || shade?.shade_image;
    if (!url || Platform.OS !== 'web') return;
    setExtracting((prev) => ({ ...prev, [id]: true }));
    const hex = await extractDominantColor(url);
    setExtracting((prev) => ({ ...prev, [id]: false }));
    if (hex) updateShade(id, 'color_hex', hex);
  };

  const removeShade = (id: string) => {
    onChange(shades.filter((s) => s.id !== id));
  };

  const moveShade = (id: string, dir: -1 | 1) => {
    const idx = shades.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= shades.length) return;
    const next = [...shades];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onChange(next);
  };

  return (
    <View style={shadeStyles.wrapper}>
      {shades.length === 0 && (
        <Text style={shadeStyles.emptyHint}>No shades added. Add shades for products with color variants.</Text>
      )}
      {shades.map((shade, idx) => (
        <View key={shade.id} style={shadeStyles.card}>
          <View style={shadeStyles.cardHeader}>
            <View style={[shadeStyles.colorPreview, { backgroundColor: shade.color_hex || '#000' }]} />
            <Text style={shadeStyles.cardIndex}>#{idx + 1}</Text>
            <Text style={shadeStyles.cardName} numberOfLines={1}>{shade.name || 'Unnamed shade'}</Text>
            <View style={shadeStyles.cardActions}>
              <TouchableOpacity
                style={[shadeStyles.shadeAvailBtn, shade.is_available !== false ? shadeStyles.shadeAvailBtnIn : shadeStyles.shadeAvailBtnOut]}
                onPress={() => updateShade(shade.id, 'is_available', shade.is_available === false)}
                activeOpacity={0.75}
              >
                <Text style={[shadeStyles.shadeAvailText, shade.is_available !== false ? shadeStyles.shadeAvailTextIn : shadeStyles.shadeAvailTextOut]}>
                  {shade.is_available !== false ? 'Available' : 'OOS'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moveShade(shade.id, -1)} disabled={idx === 0} activeOpacity={0.7} style={shadeStyles.moveBtn}>
                <ChevronUp size={14} color={idx === 0 ? Colors.textMuted : Colors.neonBlue} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => moveShade(shade.id, 1)} disabled={idx === shades.length - 1} activeOpacity={0.7} style={shadeStyles.moveBtn}>
                <ChevronDown size={14} color={idx === shades.length - 1 ? Colors.textMuted : Colors.neonBlue} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeShade(shade.id)} activeOpacity={0.7} style={shadeStyles.removeBtn}>
                <Trash2 size={13} color={Colors.error} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={shadeStyles.cardBody}>
            <View style={shadeStyles.fieldRow}>
              <View style={shadeStyles.fieldHalf}>
                <Text style={shadeStyles.label}>Name</Text>
                <TextInput
                  style={shadeStyles.input}
                  value={shade.name}
                  onChangeText={(v) => updateShade(shade.id, 'name', v)}
                  placeholder="001 Mocha Glow"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={shadeStyles.fieldHalf}>
                <Text style={shadeStyles.label}>Color Hex</Text>
                <View style={shadeStyles.colorRow}>
                  <View style={[shadeStyles.colorDot, { backgroundColor: shade.color_hex || '#000' }]} />
                  <TextInput
                    style={[shadeStyles.input, { flex: 1 }]}
                    value={shade.color_hex}
                    onChangeText={(v) => updateShade(shade.id, 'color_hex', v)}
                    placeholder="#CC6677"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                  />
                  {extracting[shade.id] ? (
                    <ActivityIndicator size="small" color={Colors.neonBlue} style={{ marginLeft: 4 }} />
                  ) : (shade.shade_image || shade.product_image) ? (
                    <TouchableOpacity
                      onPress={() => handleProductImageExtract(shade.id)}
                      activeOpacity={0.7}
                      style={shadeStyles.extractBtn}
                    >
                      <Pipette size={12} color={Colors.neonBlue} strokeWidth={2.5} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {extracting[shade.id] && (
                  <Text style={shadeStyles.extractingHint}>Extracting color...</Text>
                )}
              </View>
            </View>
            <View style={shadeStyles.fieldRow}>
              <View style={shadeStyles.fieldHalf}>
                <ImageUploader
                  value={shade.shade_image}
                  onChange={(url) => handleShadeImageChange(shade.id, url)}
                  folder="products"
                  label="Shade Swatch"
                  compact
                  previewHeight={80}
                />
              </View>
              <View style={shadeStyles.fieldHalf}>
                <ImageUploader
                  value={shade.product_image}
                  onChange={(url) => updateShade(shade.id, 'product_image', url)}
                  folder="products"
                  label="Product Image"
                  compact
                  previewHeight={80}
                />
              </View>
            </View>
          </View>
        </View>
      ))}
      <TouchableOpacity style={shadeStyles.addBtn} onPress={addShade} activeOpacity={0.8}>
        <Palette size={15} color={Colors.neonBlue} strokeWidth={2} />
        <Text style={shadeStyles.addBtnText}>Add Shade</Text>
      </TouchableOpacity>
    </View>
  );
}

const shadeStyles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  emptyHint: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: Spacing.sm, lineHeight: 18 },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: 'rgba(255,77,141,0.04)',
  },
  colorPreview: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cardIndex: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  cardName: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '600' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  moveBtn: {
    width: 28, height: 28, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,77,141,0.06)',
  },
  removeBtn: {
    width: 28, height: 28, borderRadius: 6,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,68,68,0.1)',
    marginLeft: 2,
  },
  cardBody: { padding: Spacing.sm, gap: Spacing.sm },
  fieldRow: { flexDirection: 'row', gap: Spacing.sm },
  fieldHalf: { flex: 1 },
  label: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
  },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  colorDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  extractBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255,77,141,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  extractingHint: {
    color: Colors.neonBlue,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 3,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,77,141,0.04)',
  },
  addBtnText: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '700' },
  shadeAvailBtn: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    marginRight: 4,
  },
  shadeAvailBtnIn: {
    backgroundColor: 'rgba(0,230,118,0.12)',
    borderColor: 'rgba(0,230,118,0.4)',
  },
  shadeAvailBtnOut: {
    backgroundColor: 'rgba(255,68,68,0.12)',
    borderColor: 'rgba(255,68,68,0.4)',
  },
  shadeAvailText: { fontSize: 9, fontWeight: '700' },
  shadeAvailTextIn: { color: Colors.success },
  shadeAvailTextOut: { color: Colors.error },
});

function FormField({
  label, value, onChangeText, placeholder, multiline, keyboardType, rtl,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: any; rtl?: boolean;
}) {
  return (
    <View style={styles.editField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlign={rtl ? 'right' : 'left'}
      />
    </View>
  );
}

function ProductsScreen() {
  const { t } = useLanguage();
  const { isMobile } = useAdminLayout();

  if (isMobile) {
    return (
      <AdminMobileDashboard title={t.products} showBack>
        <MobileProductsScreen />
      </AdminMobileDashboard>
    );
  }

  return (
    <AdminWebDashboard title={t.products}>
      <WebProductsScreen />
    </AdminWebDashboard>
  );
}

export default function ProductsScreenGuarded() {
  return (
    <AdminGuard permission="manage_products">
      <ProductsScreen />
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  centered: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.error + '18',
    borderWidth: 1,
    borderColor: Colors.error + '40',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  errorBannerText: {
    flex: 1,
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  errorState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: Spacing.md,
  },
  errorStateText: {
    color: Colors.error,
    fontSize: FontSize.md,
    textAlign: 'center',
    maxWidth: 340,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.neonBlue,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
  retryBtnText: {
    color: Colors.background,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  topRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  trashToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  trashToggleBtnActive: { borderColor: Colors.error + '66', backgroundColor: Colors.errorDim },
  trashToggleText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    flex: 1,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  addBtnText: {
    color: Colors.background,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  lowStockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warning + '15',
    borderWidth: 1,
    borderColor: Colors.warning + '40',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  lowStockBannerText: {
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  catFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catFilterChipActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlueBorder,
  },
  catFilterChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  catFilterChipTextActive: {
    color: Colors.neonBlue,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  productCardLowStock: {
    borderColor: Colors.warning + '50',
  },
  mobileProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  productThumb: {
    width: 52,
    height: 52,
    borderRadius: Radius.sm,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  productMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 1,
    textTransform: 'capitalize',
  },
  productStock: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.warning + '18',
    borderRadius: Radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  lowStockBadgeText: {
    color: Colors.warning,
    fontSize: 9,
    fontWeight: '700',
  },
  quickStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickStockInput: {
    width: 52,
    height: 26,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    paddingHorizontal: 6,
    textAlign: 'center',
  },
  quickStockSave: {
    height: 26,
    paddingHorizontal: 8,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickStockSaveText: {
    color: Colors.background,
    fontSize: 10,
    fontWeight: '800',
  },
  quickStockCancel: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  productActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  availabilityBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  availabilityBtnIn: {
    backgroundColor: 'rgba(0,230,118,0.12)',
    borderColor: 'rgba(0,230,118,0.4)',
  },
  availabilityBtnOut: {
    backgroundColor: 'rgba(255,68,68,0.12)',
    borderColor: 'rgba(255,68,68,0.4)',
  },
  availabilityBtnText: { fontSize: 10, fontWeight: '700' },
  availabilityBtnTextIn: { color: Colors.success },
  availabilityBtnTextOut: { color: Colors.error },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.neonBlueGlow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  modal: {
    flex: 1,
    backgroundColor: '#070D1A',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingTop: Platform.OS === 'ios' ? 56 : Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  modalBody: {
    flex: 1,
    padding: Spacing.lg,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === 'ios' ? 36 : Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
  },
  primaryLangBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.gold + '15',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.gold + '35',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginBottom: Spacing.sm,
  },
  primaryLangLabel: {
    color: Colors.gold,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  arPrimaryNote: {
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  arPrimaryNoteText: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'right',
  },
  langTabs: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  langTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  langTabActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlueBorder,
  },
  langTabPrimary: {
    borderColor: Colors.gold + '50',
  },
  langTabText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  langTabTextActive: {
    color: Colors.neonBlue,
  },
  editField: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  bonusSection: {
    borderWidth: 1,
    borderColor: Colors.gold + '40',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.gold + '08',
  },
  bonusSectionSub: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  bonusModeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  bonusModeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  bonusModeBtnActive: {
    borderColor: Colors.gold,
    backgroundColor: Colors.gold + '18',
  },
  bonusModeBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  bonusModeBtnTextActive: {
    color: Colors.gold,
  },
  bonusPreview: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: 4,
  },
  bonusPreviewText: {
    color: Colors.gold,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(0,230,118,0.06)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.2)',
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  notifyCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginTop: 1,
    flexShrink: 0,
  },
  notifyCheckboxOn: {
    borderColor: Colors.success,
    backgroundColor: 'rgba(0,230,118,0.2)',
  },
  notifyCheckmark: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 17,
  },
  notifyLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  notifySub: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlueBorder,
  },
  catChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  catChipTextActive: {
    color: Colors.neonBlue,
  },
  subCatChipNone: {
    backgroundColor: Colors.backgroundCard,
    borderColor: Colors.textMuted + '55',
  },
  subCatChipNoneText: {
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  makeupSubRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    marginBottom: Spacing.md,
  },
  makeupSubChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  makeupSubChipActive: {
    backgroundColor: 'rgba(255,77,141,0.15)',
    borderColor: Colors.neonBlue,
  },
  makeupSubChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  makeupSubChipTextActive: {
    color: Colors.neonBlue,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  makeupSubBadge: {
    backgroundColor: 'rgba(255,77,141,0.12)',
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.3)',
  },
  makeupSubBadgeText: {
    color: Colors.neonBlue,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  translateBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.neonBlueGlow ?? 'rgba(255,77,141,0.08)',
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder ?? 'rgba(255,77,141,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  translateBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.neonBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  confirmBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  confirmMsg: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    marginBottom: Spacing.lg,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  // Overwrite checkbox
  overwriteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: 'rgba(255,77,141,0.04)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.neonBlue,
    borderColor: Colors.neonBlue,
  },
  overwriteLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  overwriteHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  // Re-translate modal
  reTranslateBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.xl,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  reTranslateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reTranslateIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reTranslateTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  reTranslateProduct: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  reTranslateDesc: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  langChips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.md,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  langChipText: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.success + '15',
    borderWidth: 1,
    borderColor: Colors.success + '40',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  statusSuccessText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  statusError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.error + '15',
    borderWidth: 1,
    borderColor: Colors.error + '40',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  statusErrorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  reTranslateBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    justifyContent: 'flex-end',
  },
  reTranslateRunBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.neonBlue,
  },
  detailContainer: {
    paddingBottom: 40,
  },
  backRow: {
    marginBottom: Spacing.md,
  },
  backLink: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  editCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  editCardTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  editCardSub: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  successBanner: {
    backgroundColor: Colors.success + '22',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  successText: {
    color: Colors.success,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
