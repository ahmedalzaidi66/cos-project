import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
  I18nManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Camera,
  Sparkles,
  ShoppingBag,
  Layers,
  Check,
} from 'lucide-react-native';
import { supabase, Product, Category, fetchCategories, getCategoryName } from '@/lib/supabase';
import { useCMS } from '@/context/CMSContext';
import AppHeader from '@/components/AppHeader';
import { useLanguage } from '@/context/LanguageContext';
import { PageBlock } from '@/context/PageBuilderContext';
import { useLayout, SectionId, SpacingBreakpoint } from '@/context/LayoutContext';
import { Colors, Radius, Spacing, FontSize } from '@/constants/theme';
import { useAppColors } from '@/context/ThemeContext';
import { formatPrice } from '@/lib/currency';
import HeroVideo from '@/components/HeroVideo';
import { getProductName, getProductImage } from '@/lib/supabase';
import StarRating from '@/components/StarRating';
import { useCart } from '@/context/CartContext';
import WishlistHeart from '@/components/WishlistHeart';
import { useWishlistToast } from '@/context/WishlistToastContext';
import { AutoScrollRow } from '@/components/AutoScrollRow';

// ─── Types ────────────────────────────────────────────────────────────────────

type HomepageSection = {
  id: string;
  title_ar: string;
  title_en: string;
  sort_order: number;
  products: Product[];
};

type SectionMap = Map<string, HomepageSection>;

// ─── Layout spacing hook (used by BeautyTryOnHero internally) ────────────────

function clampSpacing(sp: SpacingBreakpoint): SpacingBreakpoint {
  return {
    marginTop:     Math.max(0, Math.min(200, sp.marginTop)),
    marginBottom:  Math.max(0, Math.min(200, sp.marginBottom)),
    paddingTop:    Math.max(0, Math.min(160, sp.paddingTop)),
    paddingBottom: Math.max(0, Math.min(160, sp.paddingBottom)),
    paddingLeft:   Math.max(0, Math.min(120, sp.paddingLeft)),
    paddingRight:  Math.max(0, Math.min(120, sp.paddingRight)),
    maxWidth:      Math.max(0, Math.min(1800, sp.maxWidth)),
    borderRadius:  Math.max(0, Math.min(64, sp.borderRadius)),
  };
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ShopScreen() {
  const { language, t } = useLanguage();
  const C = useAppColors();
  const { content, cmsRow, refresh: refreshCMS } = useCMS();

  const [categories, setCategories] = useState<Category[]>([]);
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [sectionMap, setSectionMap] = useState<SectionMap>(new Map());
  const [refreshing, setRefreshing] = useState(false);

  const committedLanguage = useRef(language);

  // ── Fetch homepage sections with their products → keyed by section id ────

  const fetchSections = useCallback(async (lang: string): Promise<SectionMap> => {
    // Fetch all sections (active ones will be shown; we index by id for block lookup)
    const { data: sectionsData, error: sectionsError } = await supabase
      .from('homepage_sections')
      .select('id, title_ar, title_en, sort_order')
      .eq('is_active', true);

    if (sectionsError || !sectionsData || committedLanguage.current !== lang) return new Map();
    if (sectionsData.length === 0) return new Map();

    const sectionIds = sectionsData.map(s => s.id);
    const { data: spData, error: spError } = await supabase
      .from('homepage_section_products')
      .select('section_id, product_id, sort_order')
      .in('section_id', sectionIds)
      .order('sort_order', { ascending: true });

    if (spError || committedLanguage.current !== lang) return new Map();

    const allProductIds = [...new Set((spData ?? []).map(sp => sp.product_id))];
    if (allProductIds.length === 0) return new Map();

    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select(`
        id, name, name_ar, name_es, name_de, price, compare_price,
        category, category_id, makeup_subcategory, image_url, main_image,
        rating, review_count, badge, is_featured, featured, stock, status,
        slug, try_on_type, created_at,
        translation:product_translations!left(language, name, short_description)
      `)
      .in('id', allProductIds)
      .eq('status', 'active');

    if (productsError || committedLanguage.current !== lang) return new Map();

    const normalizeProduct = (row: any): Product => {
      const translations: any[] = Array.isArray(row.translation) ? row.translation : row.translation ? [row.translation] : [];
      const tr = translations.find((tr: any) => tr.language === lang) ?? translations.find((tr: any) => tr.language === 'en') ?? null;
      return {
        ...row,
        name: tr?.name || row.name,
        description: tr?.short_description || row.description,
        translation: tr ?? null,
      } as Product;
    };

    const productMap = new Map<string, Product>(
      (productsData ?? []).map(row => [row.id, normalizeProduct(row)])
    );

    const result: SectionMap = new Map();
    for (const sec of sectionsData) {
      const sps = (spData ?? [])
        .filter(sp => sp.section_id === sec.id)
        .sort((a, b) => a.sort_order - b.sort_order);
      const products = sps
        .map(sp => productMap.get(sp.product_id))
        .filter((p): p is Product => p !== undefined);
      if (products.length > 0) {
        result.set(sec.id, { id: sec.id, title_ar: sec.title_ar, title_en: sec.title_en, sort_order: sec.sort_order, products });
      }
    }
    return result;
  }, []);

  // ── Fetch everything ──────────────────────────────────────────────────────

  const fetchAll = useCallback(async (fetchLang: string) => {
    const [layoutRes, categoriesRes] = await Promise.allSettled([
      supabase.from('page_layouts').select('id').eq('page', 'home').maybeSingle(),
      fetchCategories(fetchLang),
    ]);

    if (committedLanguage.current !== fetchLang) return;

    if (categoriesRes.status === 'fulfilled') setCategories(categoriesRes.value);

    if (layoutRes.status === 'fulfilled' && layoutRes.value.data) {
      const { data: blocksData } = await supabase
        .from('page_blocks')
        .select('*')
        .eq('layout_id', layoutRes.value.data.id)
        .order('order_index', { ascending: true });
      if (committedLanguage.current !== fetchLang) return;
      if (blocksData) setBlocks(blocksData as PageBlock[]);
    }

    const map = await fetchSections(fetchLang);
    if (committedLanguage.current === fetchLang) setSectionMap(map);
    setRefreshing(false);
  }, [fetchSections]);

  useEffect(() => {
    committedLanguage.current = language;
    fetchAll(language);
  }, [language, fetchAll]);

  // ── Hero content ──────────────────────────────────────────────────────────

  const visibleBlocks = useMemo(() => blocks.filter(b => b.visible), [blocks]);
  const heroBlock = visibleBlocks.find(b => b.type === 'hero');
  const cmsHero = content.hero ?? {};
  const blockHero = heroBlock?.content ?? {};

  const heroContent = {
    media_type:    cmsHero.media_type  || blockHero.media_type  || 'image',
    image_url:     cmsHero.image_url   || blockHero.image_url   || cmsRow?.hero_image || 'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=800',
    video_url:     cmsHero.video_url   || blockHero.video_url   || '',
    title:         cmsHero.title       || blockHero.title       || cmsRow?.hero_title       || t.heroDefault.title,
    subtitle:      cmsHero.subtitle    || blockHero.subtitle    || cmsRow?.hero_subtitle    || t.heroDefault.subtitle,
    badge_text:    cmsHero.badge_text  || blockHero.badge_text  || t.heroDefault.badge,
    cta_primary:   cmsHero.cta_primary || blockHero.cta_primary || cmsRow?.hero_button_text || t.shop,
    cta_secondary: cmsHero.cta_secondary || blockHero.cta_secondary || '',
    overlay_color: cmsHero.overlay_color || blockHero.overlay_color || 'rgba(10,5,7,0.55)',
  };

  // ── Render blocks in unified page_blocks order ────────────────────────────

  const renderBlock = useCallback((block: PageBlock) => {
    if (!block.visible) return null;

    switch (block.type) {
      case 'hero':
        return <HeroVideo key={block.id} heroContent={heroContent} />;
      case 'categories':
        return <ShopByCategorySection key={block.id} categories={categories} language={language} />;
      case 'canopy':
        return <BeautyTryOnHero key={block.id} />;
      case 'section_row': {
        const sectionId = block.content?.section_id as string | undefined;
        if (!sectionId) return null;
        const section = sectionMap.get(sectionId);
        if (!section) return null;
        return <HomeSectionRow key={block.id} section={section} language={language} />;
      }
      default:
        return null;
    }
  }, [heroContent, categories, sectionMap, language]);

  // If no blocks loaded yet, fall back to legacy static order
  const hasBlocks = visibleBlocks.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <AppHeader />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              committedLanguage.current = language;
              fetchAll(language);
              refreshCMS(language);
            }}
            tintColor={Colors.neonBlue}
          />
        }
      >
        {hasBlocks
          ? visibleBlocks.map(block => renderBlock(block))
          : (
            <>
              <HeroVideo heroContent={heroContent} />
              <ShopByCategorySection categories={categories} language={language} />
              <BeautyTryOnHero />
            </>
          )
        }

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ─── Shop by Category ─────────────────────────────────────────────────────────

const CATEGORY_FALLBACK_COLORS: Record<string, string> = {
  lipstick:    '#B22234',
  blush:       '#E07B8B',
  concealer:   '#D4A574',
  foundation:  '#C4956A',
  skincare:    '#8BC4A8',
  tools:       '#A88BC4',
  sets:        '#C4A88B',
  accessories: '#8BA8C4',
};

function getCategoryColor(slug: string): string {
  for (const [key, color] of Object.entries(CATEGORY_FALLBACK_COLORS)) {
    if (slug.includes(key)) return color;
  }
  return '#C08081';
}

function ShopByCategorySection({ categories, language }: { categories: Category[]; language: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const C = useAppColors();
  const isRTL = language === 'ar' || language === 'ckb';

  if (categories.length === 0) return null;

  return (
    <View style={[catStyles.section, { backgroundColor: C.background }]}>
      <View style={[catStyles.headerRow, isRTL && catStyles.headerRowRTL]}>
        <Text style={[catStyles.title, { color: C.textPrimary }]}>{t.shopByCategory}</Text>
        <TouchableOpacity
          style={catStyles.viewAllBtn}
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/products' as any)}
        >
          <Text style={catStyles.viewAllText}>{t.viewAll}</Text>
          <ChevronRight size={13} color={Colors.neonBlue} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <AutoScrollRow contentContainerStyle={catStyles.scrollContent}>
        {categories.map((cat) => {
          const name = getCategoryName(cat, language);
          const color = getCategoryColor(cat.slug);
          return (
            <TouchableOpacity
              key={cat.id}
              style={catStyles.card}
              activeOpacity={0.82}
              onPress={() => router.push({ pathname: '/(tabs)/products', params: { category: cat.slug } } as any)}
            >
              <View style={[catStyles.ringOuter, { borderColor: color + '44' }]}>
                <View style={[catStyles.ringInner, { borderColor: color + '88', backgroundColor: color + '18' }]}>
                  {cat.icon_url ? (
                    <Image source={{ uri: cat.icon_url }} style={catStyles.icon} resizeMode="cover" />
                  ) : (
                    <View style={[catStyles.iconFallback, { backgroundColor: color + '33' }]}>
                      <Layers size={16} color={color} strokeWidth={1.5} />
                    </View>
                  )}
                </View>
              </View>
              <Text style={[catStyles.label, { color: C.textSecondary }]} numberOfLines={2}>{name}</Text>
            </TouchableOpacity>
          );
        })}
      </AutoScrollRow>
    </View>
  );
}

const catStyles = StyleSheet.create({
  section: { paddingTop: 14, paddingBottom: 3 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 10 },
  headerRowRTL: { flexDirection: 'row-reverse' },
  title: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewAllText: { color: Colors.neonBlue, fontSize: 11, fontWeight: '600' },
  scrollContent: { paddingHorizontal: 10, gap: 9, paddingBottom: 3 },
  card: { alignItems: 'center', width: 56, gap: 5 },
  ringOuter: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, padding: 2, justifyContent: 'center', alignItems: 'center' },
  ringInner: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  icon: { width: '100%', height: '100%', borderRadius: 22 },
  iconFallback: { width: '100%', height: '100%', borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  label: { color: '#F0D0E0', fontSize: 9, fontWeight: '600', textAlign: 'center', lineHeight: 12, maxWidth: 54 },
});

// ─── Beauty Try-On Hero ───────────────────────────────────────────────────────

const FLOATING_SHADES = [
  { color: '#B22234', x: '8%',  y: '14%', size: 14 },
  { color: '#E88BA5', x: '82%', y: '10%', size: 11 },
  { color: '#C08081', x: '88%', y: '48%', size: 13 },
  { color: '#F4A28C', x: '5%',  y: '55%', size: 10 },
  { color: '#8E3A59', x: '76%', y: '72%', size: 9 },
  { color: '#E07B8B', x: '14%', y: '78%', size: 12 },
];

function BeautyTryOnHero() {
  const router = useRouter();
  const { t } = useLanguage();
  const C = useAppColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 640;
  const faceSize = isWide ? 136 : Math.min(width * 0.15, 58);

  return (
    <View style={[tryOnStyles.wrapper, { backgroundColor: C.backgroundCard }]}>
      <LinearGradient
        colors={['rgba(255,77,141,0.18)', 'rgba(180,40,100,0.08)', 'rgba(10,5,7,0)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <LinearGradient
        colors={['transparent', 'rgba(255,77,141,0.06)', 'transparent']}
        style={[StyleSheet.absoluteFill, { opacity: 0.7 }]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View style={tryOnStyles.glowOrb} />

      {FLOATING_SHADES.map((shade, i) => (
        <View
          key={i}
          style={[
            tryOnStyles.floatingShade,
            { width: shade.size, height: shade.size, borderRadius: shade.size / 2, backgroundColor: shade.color, left: shade.x as any, top: shade.y as any, opacity: 0.55 },
          ]}
        />
      ))}

      <View style={[tryOnStyles.content, isWide && { paddingTop: 20, paddingBottom: 24, gap: 12 }]}>
        <View style={[tryOnStyles.badge, isWide && { paddingHorizontal: 10, paddingVertical: 4 }]}>
          <Sparkles size={isWide ? 9 : 6} color={Colors.neonBlue} strokeWidth={2.5} />
          <Text style={[tryOnStyles.badgeText, isWide && { fontSize: 8 }]}>{t.tryOnBadge}</Text>
        </View>

        <Text style={[tryOnStyles.title, { color: C.textPrimary }, isWide && { fontSize: 24, lineHeight: 30 }]}>
          {t.tryOnTitle}{'\n'}
          <Text style={tryOnStyles.titleAccent}>{t.tryOnTitleAccent}</Text>
        </Text>

        {isWide && (
          <Text style={[tryOnStyles.subtitle, { color: C.textSecondary, fontSize: 11, lineHeight: 16 }]}>
            {t.tryOnSubtitle}
          </Text>
        )}

        <View style={tryOnStyles.faceRow}>
          <View style={tryOnStyles.faceCard}>
            <View style={[tryOnStyles.faceImageWrap, { width: faceSize, height: faceSize }]}>
              {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
              <Image source={require('../../assets/images/canopy/canopy-before.png')} style={tryOnStyles.faceImage} resizeMode="cover" />
              <View style={tryOnStyles.faceLabel}>
                <Text style={tryOnStyles.faceLabelText}>{t.tryOnBefore}</Text>
              </View>
            </View>
          </View>

          <View style={[tryOnStyles.arrowWrap, isWide && { width: 30, height: 30, borderRadius: 15 }]}>
            <Sparkles size={isWide ? 15 : 8} color={Colors.neonBlue} strokeWidth={2} />
          </View>

          <View style={tryOnStyles.faceCard}>
            <View style={[tryOnStyles.faceImageWrap, tryOnStyles.faceImageWrapAfter, { width: faceSize, height: faceSize }]}>
              {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
              <Image source={require('../../assets/images/canopy/canopy-after.png')} style={tryOnStyles.faceImage} resizeMode="cover" />
              <LinearGradient colors={['transparent', 'rgba(255,77,141,0.15)']} style={StyleSheet.absoluteFill} />
              <View style={[tryOnStyles.faceLabel, tryOnStyles.faceLabelAfter]}>
                <Text style={[tryOnStyles.faceLabelText, { color: Colors.neonBlue }]}>{t.tryOnAfter}</Text>
              </View>
            </View>
            <View style={tryOnStyles.afterShadeDots}>
              {['#B22234', '#C08081', '#E88BA5'].map((c, i) => (
                <View key={i} style={[tryOnStyles.afterShadeDot, { backgroundColor: c }]} />
              ))}
            </View>
          </View>
        </View>

        <View style={tryOnStyles.categoriesRow}>
          {[
            { label: t.tryOnCatLipstick, color: '#B22234' },
            { label: t.tryOnCatBlush, color: '#E07B8B' },
            { label: t.tryOnCatConcealer, color: '#D4A574' },
            { label: t.tryOnCatFoundation, color: '#C4956A' },
          ].map((cat) => (
            <View key={cat.label} style={tryOnStyles.categoryChip}>
              <View style={[tryOnStyles.categoryDot, { backgroundColor: cat.color }]} />
              <Text style={[tryOnStyles.categoryText, { color: C.textSecondary }]}>{cat.label}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[tryOnStyles.ctaBtn, isWide && { paddingVertical: 12, paddingHorizontal: 30, gap: 8 }]}
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/canopy')}
        >
          <LinearGradient colors={['#FF4D8D', '#E0356E']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <View style={tryOnStyles.ctaGlow} />
          <Camera size={isWide ? 14 : 9} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={[tryOnStyles.ctaText, isWide && { fontSize: 12 }]}>{t.tryOnCta}</Text>
          <ChevronRight size={isWide ? 12 : 8} color="rgba(255,255,255,0.7)" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const tryOnStyles = StyleSheet.create({
  wrapper: { marginHorizontal: 0, marginTop: 8, overflow: 'hidden', backgroundColor: '#1A0A12', borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,77,141,0.15)', position: 'relative' },
  glowOrb: { position: 'absolute', width: 75, height: 75, borderRadius: 38, backgroundColor: 'rgba(255,77,141,0.08)', top: '20%', left: '50%', marginLeft: -38, shadowColor: '#FF4D8D', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 0 },
  floatingShade: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 1 },
  content: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 6, alignItems: 'center', gap: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,77,141,0.12)', borderWidth: 1, borderColor: 'rgba(255,77,141,0.25)', borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: Colors.neonBlue, fontSize: 6, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', textAlign: 'center', lineHeight: 15, letterSpacing: -0.3 },
  titleAccent: { color: Colors.neonBlue, textShadowColor: 'rgba(255,77,141,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  subtitle: { color: '#D6A0B8', fontSize: 9, fontWeight: '400', textAlign: 'center', lineHeight: 13, opacity: 0.85 },
  faceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 0 },
  faceCard: { alignItems: 'center', position: 'relative' },
  faceImageWrap: { borderRadius: 6, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#140A10' },
  faceImageWrapAfter: { borderColor: 'rgba(255,77,141,0.35)', shadowColor: '#FF4D8D', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 },
  faceImage: { width: '100%', height: '100%' },
  faceLabel: { position: 'absolute', bottom: 2, left: 2, backgroundColor: 'rgba(10,5,7,0.75)', borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  faceLabelAfter: { borderColor: 'rgba(255,77,141,0.3)', backgroundColor: 'rgba(10,5,7,0.8)' },
  faceLabelText: { color: 'rgba(255,255,255,0.7)', fontSize: 5, fontWeight: '900', letterSpacing: 1 },
  afterShadeDots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  afterShadeDot: { width: 5, height: 5, borderRadius: 2.5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  arrowWrap: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,77,141,0.12)', borderWidth: 1, borderColor: 'rgba(255,77,141,0.25)', justifyContent: 'center', alignItems: 'center' },
  categoriesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.full, paddingHorizontal: 5, paddingVertical: 2 },
  categoryDot: { width: 4, height: 4, borderRadius: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  categoryText: { color: '#D6A0B8', fontSize: 7, fontWeight: '600', letterSpacing: 0.2 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: Radius.full, paddingVertical: 5, paddingHorizontal: 15, overflow: 'hidden', position: 'relative', marginTop: 1 },
  ctaGlow: { position: 'absolute', width: 45, height: 45, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', top: -17, left: '30%' },
  ctaText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 2.5, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
});

// ─── Homepage Section Row ─────────────────────────────────────────────────────

// Memoized card so AutoScrollRow content doesn't re-render every parent tick
const HomeSectionCard = memo(function HomeSectionCard({
  product,
  language,
  justAdded,
  cardBg,
  imageWrapBg,
  textColor,
  onPress,
  onAddToCart,
  addToCartLabel,
}: {
  product: Product;
  language: string;
  justAdded: boolean;
  cardBg?: string;
  imageWrapBg?: string;
  textColor?: string;
  onPress: () => void;
  onAddToCart: (e: any) => void;
  addToCartLabel: string;
}) {
  const imgUri = getProductImage(product) || undefined;
  return (
    <View style={[styles.card, cardBg ? { backgroundColor: cardBg } : undefined]}>
      <View style={[styles.cardImageWrap, imageWrapBg ? { backgroundColor: imageWrapBg } : undefined]}>
        <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.cardImageTouchable}>
          <Image
            source={imgUri ? { uri: imgUri } : undefined}
            style={styles.cardImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
        {product.badge ? (
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>{product.badge}</Text>
          </View>
        ) : null}
        <WishlistHeart product={product} size={10} variant="card" />
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, textColor ? { color: textColor } : undefined]} numberOfLines={2}>
          {getProductName(product, language)}
        </Text>
        <StarRating rating={product.rating} reviewCount={product.review_count} size={8} showCount={false} />
        <Text style={styles.cardPrice}>{formatPrice(product.price, language)}</Text>
        <TouchableOpacity
          style={[styles.cartBtn, justAdded && styles.cartBtnAdded]}
          activeOpacity={0.85}
          onPress={onAddToCart}
        >
          {justAdded
            ? <Check size={9} color="#FFFFFF" strokeWidth={2.5} />
            : <ShoppingBag size={9} color="#FFFFFF" strokeWidth={2.5} />
          }
          <Text style={styles.cartBtnText}>
            {justAdded ? 'ADDED' : addToCartLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const HomeSectionRow = memo(function HomeSectionRow({ section, language }: { section: HomepageSection; language: string }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { t } = useLanguage();
  const C = useAppColors();
  const { showCartToast } = useWishlistToast();
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const title = language === 'ar'
    ? (section.title_ar || section.title_en)
    : (section.title_en || section.title_ar);

  const addToCartLabel = t.addToCart.toUpperCase();

  return (
    <View style={[styles.sectionWrap, { backgroundColor: C.background }]}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>{title.toUpperCase()}</Text>
        <TouchableOpacity
          style={styles.seeAllBtn}
          onPress={() => router.push('/(tabs)/products' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.seeAllDots}>
            {[0, 1, 2].map(i => <View key={i} style={styles.seeAllDot} />)}
          </View>
          <ChevronRight size={13} color={Colors.neonBlue} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <AutoScrollRow contentContainerStyle={styles.rowScrollContent}>
        {section.products.map(product => (
          <HomeSectionCard
            key={product.id}
            product={product}
            language={language}
            justAdded={justAddedId === product.id}
            cardBg={C.backgroundCard}
            imageWrapBg={C.backgroundInput}
            textColor={C.textPrimary}
            onPress={() => router.push(`/product/${product.id}`)}
            onAddToCart={(e) => {
              const nativeEv = e?.nativeEvent as any;
              if (nativeEv?.stopPropagation) nativeEv.stopPropagation();
              addToCart(product);
              showCartToast('Added to cart');
              setJustAddedId(product.id);
              setTimeout(() => setJustAddedId(null), 1000);
            }}
            addToCartLabel={addToCartLabel}
          />
        ))}
      </AutoScrollRow>
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 8 },

  // Section header
  sectionWrap: { paddingTop: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 7 },
  sectionTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.8 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllDots: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  seeAllDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.neonBlue },

  // Product card
  rowScrollContent: { paddingHorizontal: 10, gap: 8, paddingBottom: 3 },
  card: { width: 106, backgroundColor: '#1E0F18', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,77,141,0.15)', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  cardImageWrap: { width: '100%', height: 82, backgroundColor: '#140A10', position: 'relative' },
  cardImageTouchable: { width: '100%', height: '100%' as any },
  cardImage: { width: '100%', height: '100%' },
  cardBadge: { position: 'absolute', top: 4, left: 4, backgroundColor: Colors.neonBlue, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  cardBadgeText: { color: '#FFFFFF', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  cardInfo: { padding: 5, gap: 2 },
  cardName: { color: '#FDE8F0', fontSize: 9, fontWeight: '700', lineHeight: 12 },
  cardPrice: { color: Colors.neonBlue, fontSize: 10, fontWeight: '900', marginTop: 1 },
  cartBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: Colors.neonBlue, borderRadius: Radius.full, paddingVertical: 3, marginTop: 2, shadowColor: '#FF4D8D', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 3, elevation: 3 },
  cartBtnAdded: { backgroundColor: '#1a7a45' },
  cartBtnText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900', letterSpacing: 1 },

});
