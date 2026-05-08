import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import { supabase, adminSupabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GlobalSizes = {
  pageMaxWidth: number;
  horizontalPadding: number;
  verticalSpacing: number;
  sectionGap: number;
  borderRadiusScale: number;
  shadowIntensity: number;
  buttonRadius: number;
  cardRadius: number;
};

export type HeaderSizes = {
  headerHeight: number;
  paddingLeft: number;
  paddingRight: number;
  logoWidth: number;
  logoHeight: number;
  iconSize: number;
  langSwitchSize: number;
  menuBtnSize: number;
};

export type SearchSizes = {
  barWidth: number;
  barHeight: number;
  iconSize: number;
  fontSize: number;
  borderRadius: number;
  marginTop: number;
  marginBottom: number;
};

export type FilterSizes = {
  buttonHeight: number;
  paddingH: number;
  paddingV: number;
  fontSize: number;
  gap: number;
  borderRadius: number;
};

export type ProductCardSizes = {
  columns: number;
  cardWidth: number;
  cardHeight: number;
  imageHeight: number;
  cardPadding: number;
  cardGap: number;
  titleFontSize: number;
  priceFontSize: number;
  ratingFontSize: number;
  addToCartBtnSize: number;
};

export type BottomNavSizes = {
  navHeight: number;
  iconSize: number;
  labelFontSize: number;
  borderTopWidth: number;
  itemSpacing: number;
};

export type UISizeBreakpoints<T> = {
  mobile: T;
  tablet: T;
  desktop: T;
};

export type CategoryId = 'global' | 'header' | 'search' | 'filter' | 'product_card' | 'bottom_nav';

export type UISizeCategory = {
  id: string;
  category: CategoryId;
  label: string;
  mobile: Record<string, number>;
  tablet: Record<string, number>;
  desktop: Record<string, number>;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_GLOBAL: UISizeBreakpoints<GlobalSizes> = {
  mobile:  { pageMaxWidth: 0,    horizontalPadding: 12, verticalSpacing: 12, sectionGap: 18, borderRadiusScale: 1, shadowIntensity: 1, buttonRadius: 6,  cardRadius: 10 },
  tablet:  { pageMaxWidth: 0,    horizontalPadding: 16, verticalSpacing: 12, sectionGap: 18, borderRadiusScale: 1, shadowIntensity: 1, buttonRadius: 6,  cardRadius: 10 },
  desktop: { pageMaxWidth: 1280, horizontalPadding: 20, verticalSpacing: 18, sectionGap: 24, borderRadiusScale: 1, shadowIntensity: 1, buttonRadius: 6,  cardRadius: 10 },
};

export const DEFAULT_HEADER: UISizeBreakpoints<HeaderSizes> = {
  mobile:  { headerHeight: 40, paddingLeft: 8, paddingRight: 8, logoWidth: 80, logoHeight: 18, iconSize: 14, langSwitchSize: 14, menuBtnSize: 14 },
  tablet:  { headerHeight: 40, paddingLeft: 8, paddingRight: 8, logoWidth: 80, logoHeight: 18, iconSize: 14, langSwitchSize: 14, menuBtnSize: 14 },
  desktop: { headerHeight: 45, paddingLeft: 14, paddingRight: 14, logoWidth: 90, logoHeight: 21, iconSize: 14, langSwitchSize: 14, menuBtnSize: 14 },
};

export const DEFAULT_SEARCH: UISizeBreakpoints<SearchSizes> = {
  mobile:  { barWidth: 100, barHeight: 32, iconSize: 14, fontSize: 12, borderRadius: 6,  marginTop: 6,  marginBottom: 3 },
  tablet:  { barWidth: 100, barHeight: 32, iconSize: 14, fontSize: 12, borderRadius: 6,  marginTop: 6,  marginBottom: 3 },
  desktop: { barWidth: 100, barHeight: 34, iconSize: 14, fontSize: 13, borderRadius: 6,  marginTop: 6,  marginBottom: 3 },
};

export const DEFAULT_FILTER: UISizeBreakpoints<FilterSizes> = {
  mobile:  { buttonHeight: 26, paddingH: 10, paddingV: 4, fontSize: 11, gap: 5,  borderRadius: 13 },
  tablet:  { buttonHeight: 26, paddingH: 10, paddingV: 4, fontSize: 11, gap: 5,  borderRadius: 13 },
  desktop: { buttonHeight: 28, paddingH: 11, paddingV: 5, fontSize: 12, gap: 6,  borderRadius: 13 },
};

export const DEFAULT_PRODUCT_CARD: UISizeBreakpoints<ProductCardSizes> = {
  mobile:  { columns: 2, cardWidth: 0, cardHeight: 0, imageHeight: 88,  cardPadding: 5,  cardGap: 5,  titleFontSize: 11, priceFontSize: 11, ratingFontSize: 9,  addToCartBtnSize: 10 },
  tablet:  { columns: 3, cardWidth: 0, cardHeight: 0, imageHeight: 100, cardPadding: 6,  cardGap: 6,  titleFontSize: 11, priceFontSize: 12, ratingFontSize: 9,  addToCartBtnSize: 10 },
  desktop: { columns: 4, cardWidth: 0, cardHeight: 0, imageHeight: 112, cardPadding: 8,  cardGap: 8,  titleFontSize: 12, priceFontSize: 13, ratingFontSize: 10, addToCartBtnSize: 11 },
};

export const DEFAULT_BOTTOM_NAV: UISizeBreakpoints<BottomNavSizes> = {
  mobile:  { navHeight: 48, iconSize: 18, labelFontSize: 9,  borderTopWidth: 1, itemSpacing: 0 },
  tablet:  { navHeight: 48, iconSize: 18, labelFontSize: 9,  borderTopWidth: 1, itemSpacing: 0 },
  desktop: { navHeight: 52, iconSize: 20, labelFontSize: 10, borderTopWidth: 1, itemSpacing: 0 },
};

export const CATEGORY_DEFAULTS: Record<CategoryId, { label: string; mobile: Record<string, number>; tablet: Record<string, number>; desktop: Record<string, number> }> = {
  global:       { label: 'Global',         mobile: DEFAULT_GLOBAL.mobile       as any, tablet: DEFAULT_GLOBAL.tablet       as any, desktop: DEFAULT_GLOBAL.desktop       as any },
  header:       { label: 'Header',         mobile: DEFAULT_HEADER.mobile       as any, tablet: DEFAULT_HEADER.tablet       as any, desktop: DEFAULT_HEADER.desktop       as any },
  search:       { label: 'Search Bar',     mobile: DEFAULT_SEARCH.mobile       as any, tablet: DEFAULT_SEARCH.tablet       as any, desktop: DEFAULT_SEARCH.desktop       as any },
  filter:       { label: 'Filter Buttons', mobile: DEFAULT_FILTER.mobile       as any, tablet: DEFAULT_FILTER.tablet       as any, desktop: DEFAULT_FILTER.desktop       as any },
  product_card: { label: 'Product Card',   mobile: DEFAULT_PRODUCT_CARD.mobile as any, tablet: DEFAULT_PRODUCT_CARD.tablet as any, desktop: DEFAULT_PRODUCT_CARD.desktop as any },
  bottom_nav:   { label: 'Bottom Nav',     mobile: DEFAULT_BOTTOM_NAV.mobile   as any, tablet: DEFAULT_BOTTOM_NAV.tablet   as any, desktop: DEFAULT_BOTTOM_NAV.desktop   as any },
};

// ─── Per-field min/max clamp rules ───────────────────────────────────────────

const CLAMP_RULES: Partial<Record<CategoryId, Record<string, [number, number]>>> = {
  global: {
    pageMaxWidth:      [0,    2560],
    horizontalPadding: [0,    80],
    verticalSpacing:   [0,    80],
    sectionGap:        [0,    120],
    borderRadiusScale: [0,    3],
    shadowIntensity:   [0,    2],
    buttonRadius:      [0,    64],
    cardRadius:        [0,    64],
  },
  header: {
    headerHeight:      [40,   200],
    paddingLeft:       [0,    80],
    paddingRight:      [0,    80],
    logoWidth:         [40,   400],
    logoHeight:        [16,   80],
    iconSize:          [12,   48],
    langSwitchSize:    [12,   48],
    menuBtnSize:       [12,   48],
  },
  search: {
    barWidth:          [20,   100],
    barHeight:         [24,   80],
    iconSize:          [10,   32],
    fontSize:          [10,   24],
    borderRadius:      [0,    40],
    marginTop:         [0,    48],
    marginBottom:      [0,    48],
  },
  filter: {
    buttonHeight:      [20,   64],
    paddingH:          [4,    40],
    paddingV:          [2,    24],
    fontSize:          [9,    20],
    gap:               [0,    32],
    borderRadius:      [0,    40],
  },
  product_card: {
    columns:           [1,    6],
    cardWidth:         [0,    800],
    cardHeight:        [0,    800],
    imageHeight:       [40,   500],
    cardPadding:       [0,    40],
    cardGap:           [0,    40],
    titleFontSize:     [9,    28],
    priceFontSize:     [9,    32],
    ratingFontSize:    [8,    20],
    addToCartBtnSize:  [9,    24],
  },
  bottom_nav: {
    navHeight:         [40,   140],
    iconSize:          [12,   48],
    labelFontSize:     [8,    18],
    borderTopWidth:    [0,    4],
    itemSpacing:       [0,    48],
  },
};

export function clampCategoryValue(cat: CategoryId, key: string, val: number): number {
  const rules = CLAMP_RULES[cat];
  if (!rules || !(key in rules)) return isNaN(val) ? 0 : val;
  const [min, max] = rules[key];
  return Math.max(min, Math.min(max, isNaN(val) ? min : val));
}

function clampAllValues(cat: CategoryId, values: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(values)) {
    out[key] = clampCategoryValue(cat, key, values[key]);
  }
  return out;
}

function buildDefault(): Record<CategoryId, UISizeCategory> {
  const out: Partial<Record<CategoryId, UISizeCategory>> = {};
  for (const cat of Object.keys(CATEGORY_DEFAULTS) as CategoryId[]) {
    const d = CATEGORY_DEFAULTS[cat];
    out[cat] = {
      id: '',
      category: cat,
      label: d.label,
      mobile:  { ...d.mobile },
      tablet:  { ...d.tablet },
      desktop: { ...d.desktop },
    };
  }
  return out as Record<CategoryId, UISizeCategory>;
}

// ─── Module-level cache so remounts skip the buildDefault() flash ─────────────
let _cachedCategories: Record<CategoryId, UISizeCategory> | null = null;

// ─── Context ──────────────────────────────────────────────────────────────────

type UISizeContextType = {
  categories: Record<CategoryId, UISizeCategory>;
  loading: boolean;
  loadError: string | null;
  getBreakpointValues: <T>(cat: CategoryId) => T;
  updateCategory: (cat: CategoryId, bp: 'mobile' | 'tablet' | 'desktop', values: Record<string, number>) => void;
  saveCategory: (cat: CategoryId) => Promise<{ error?: string }>;
  saveAll: () => Promise<{ error?: string }>;
  resetCategory: (cat: CategoryId) => void;
  resetAll: () => void;
  refresh: () => Promise<void>;
  globalSizes: GlobalSizes;
  headerSizes: HeaderSizes;
  searchSizes: SearchSizes;
  filterSizes: FilterSizes;
  productCardSizes: ProductCardSizes;
  bottomNavSizes: BottomNavSizes;
  bp: 'mobile' | 'tablet' | 'desktop';
};

const UISizeContext = createContext<UISizeContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UISizeProvider({ children }: { children: React.ReactNode }) {
  const dims = useWindowDimensions();
  const width = dims?.width ?? 390;
  const bp: 'mobile' | 'tablet' | 'desktop' = width >= 1024 ? 'desktop' : width >= 600 ? 'tablet' : 'mobile';

  const [categories, setCategories] = useState<Record<CategoryId, UISizeCategory>>(_cachedCategories ?? buildDefault());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from('ui_size_settings').select('*');
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      const seedRows = (Object.keys(CATEGORY_DEFAULTS) as CategoryId[]).map(cat => ({
        category: cat,
        label:    CATEGORY_DEFAULTS[cat].label,
        mobile:   CATEGORY_DEFAULTS[cat].mobile,
        tablet:   CATEGORY_DEFAULTS[cat].tablet,
        desktop:  CATEGORY_DEFAULTS[cat].desktop,
      }));
      await adminSupabase().from('ui_size_settings').upsert(seedRows, { onConflict: 'category' });
      const seeded = buildDefault();
      _cachedCategories = seeded;
      setCategories(seeded);
      setLoading(false);
      return;
    }

    setCategories(prev => {
      const next = { ...prev };
      for (const row of data) {
        const cat = row.category as CategoryId;
        if (cat in CATEGORY_DEFAULTS) {
          next[cat] = {
            id:       row.id,
            category: cat,
            label:    row.label,
            mobile:   clampAllValues(cat, { ...CATEGORY_DEFAULTS[cat].mobile,  ...(row.mobile  ?? {}) }),
            tablet:   clampAllValues(cat, { ...CATEGORY_DEFAULTS[cat].tablet,  ...(row.tablet  ?? {}) }),
            desktop:  clampAllValues(cat, { ...CATEGORY_DEFAULTS[cat].desktop, ...(row.desktop ?? {}) }),
          };
        }
      }
      _cachedCategories = next;
      return next;
    });
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getBreakpointValues = useCallback(<T,>(cat: CategoryId): T => {
    const vals = categories[cat]?.[bp] ?? CATEGORY_DEFAULTS[cat][bp];
    return clampAllValues(cat, vals) as unknown as T;
  }, [categories, bp]);

  const updateCategory = useCallback((cat: CategoryId, breakpoint: 'mobile' | 'tablet' | 'desktop', values: Record<string, number>) => {
    const clamped = clampAllValues(cat, values);
    setCategories(prev => ({
      ...prev,
      [cat]: { ...prev[cat], [breakpoint]: { ...prev[cat][breakpoint], ...clamped } },
    }));
  }, []);

  const saveCategory = useCallback(async (cat: CategoryId): Promise<{ error?: string }> => {
    const entry = categories[cat];
    const payload = {
      category:   cat,
      label:      entry.label,
      mobile:     clampAllValues(cat, entry.mobile),
      tablet:     clampAllValues(cat, entry.tablet),
      desktop:    clampAllValues(cat, entry.desktop),
      updated_at: new Date().toISOString(),
    };
    const db = adminSupabase();
    if (entry.id) {
      const { error } = await db.from('ui_size_settings').update(payload).eq('id', entry.id);
      if (error) return { error: error.message };
    } else {
      const { data, error } = await db
        .from('ui_size_settings')
        .upsert([payload], { onConflict: 'category' })
        .select()
        .maybeSingle();
      if (error) return { error: error.message };
      if (data) setCategories(prev => ({ ...prev, [cat]: { ...prev[cat], id: data.id } }));
    }
    return {};
  }, [categories]);

  const saveAll = useCallback(async (): Promise<{ error?: string }> => {
    for (const cat of Object.keys(categories) as CategoryId[]) {
      const result = await saveCategory(cat);
      if (result.error) return result;
    }
    return {};
  }, [categories, saveCategory]);

  const resetCategory = useCallback((cat: CategoryId) => {
    setCategories(prev => ({
      ...prev,
      [cat]: {
        ...prev[cat],
        mobile:  { ...CATEGORY_DEFAULTS[cat].mobile },
        tablet:  { ...CATEGORY_DEFAULTS[cat].tablet },
        desktop: { ...CATEGORY_DEFAULTS[cat].desktop },
      },
    }));
  }, []);

  const resetAll = useCallback(() => {
    setCategories(prev => {
      const next = { ...prev };
      for (const cat of Object.keys(CATEGORY_DEFAULTS) as CategoryId[]) {
        next[cat] = {
          ...prev[cat],
          mobile:  { ...CATEGORY_DEFAULTS[cat].mobile },
          tablet:  { ...CATEGORY_DEFAULTS[cat].tablet },
          desktop: { ...CATEGORY_DEFAULTS[cat].desktop },
        };
      }
      return next;
    });
  }, []);

  const rawGlobal      = categories.global[bp]       ?? CATEGORY_DEFAULTS.global[bp];
  const rawHeader      = categories.header[bp]       ?? CATEGORY_DEFAULTS.header[bp];
  const rawSearch      = categories.search[bp]       ?? CATEGORY_DEFAULTS.search[bp];
  const rawFilter      = categories.filter[bp]       ?? CATEGORY_DEFAULTS.filter[bp];
  const rawProductCard = categories.product_card[bp] ?? CATEGORY_DEFAULTS.product_card[bp];
  const rawBottomNav   = categories.bottom_nav[bp]   ?? CATEGORY_DEFAULTS.bottom_nav[bp];

  const globalSizes      = clampAllValues('global',       rawGlobal)      as unknown as GlobalSizes;
  const headerSizes      = clampAllValues('header',       rawHeader)      as unknown as HeaderSizes;
  const searchSizes      = clampAllValues('search',       rawSearch)      as unknown as SearchSizes;
  const filterSizes      = clampAllValues('filter',       rawFilter)      as unknown as FilterSizes;
  const productCardSizes = clampAllValues('product_card', rawProductCard) as unknown as ProductCardSizes;
  const bottomNavSizes   = clampAllValues('bottom_nav',   rawBottomNav)   as unknown as BottomNavSizes;

  return (
    <UISizeContext.Provider value={{
      categories, loading, loadError,
      getBreakpointValues, updateCategory,
      saveCategory, saveAll,
      resetCategory, resetAll, refresh,
      globalSizes, headerSizes, searchSizes, filterSizes, productCardSizes, bottomNavSizes,
      bp,
    }}>
      {children}
    </UISizeContext.Provider>
  );
}

function buildFallbackCtx(): UISizeContextType {
  return {
    categories: buildDefault(),
    loading: false,
    loadError: null,
    getBreakpointValues: <T,>(cat: CategoryId) => clampAllValues(cat, CATEGORY_DEFAULTS[cat].mobile) as unknown as T,
    updateCategory: () => {},
    saveCategory: async () => ({}),
    saveAll: async () => ({}),
    resetCategory: () => {},
    resetAll: () => {},
    refresh: async () => {},
    globalSizes: clampAllValues('global', CATEGORY_DEFAULTS.global.mobile) as unknown as GlobalSizes,
    headerSizes: clampAllValues('header', CATEGORY_DEFAULTS.header.mobile) as unknown as HeaderSizes,
    searchSizes: clampAllValues('search', CATEGORY_DEFAULTS.search.mobile) as unknown as SearchSizes,
    filterSizes: clampAllValues('filter', CATEGORY_DEFAULTS.filter.mobile) as unknown as FilterSizes,
    productCardSizes: clampAllValues('product_card', CATEGORY_DEFAULTS.product_card.mobile) as unknown as ProductCardSizes,
    bottomNavSizes: clampAllValues('bottom_nav', CATEGORY_DEFAULTS.bottom_nav.mobile) as unknown as BottomNavSizes,
    bp: 'mobile',
  };
}

export function useUISize(): UISizeContextType {
  const ctx = useContext(UISizeContext);
  if (!ctx) return buildFallbackCtx();
  return ctx;
}
