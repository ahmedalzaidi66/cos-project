import React, {
  useState, useEffect, useCallback, useRef, useMemo, memo,
} from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList,
  TextInput, Platform, useWindowDimensions, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Pressable,
} from 'react-native';
import { Search, X, Clock, TrendingUp, SlidersHorizontal, ChevronDown, ChevronUp, Star, Check, ArrowUpDown } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, Product, Category, getProductName, fetchCategories } from '@/lib/supabase';
import { useAppColors } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import ProductCard from '@/components/ProductCard';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { SearchResultsSkeleton } from '@/components/Skeleton';

// ─── Constants ────────────────────────────────────────────────────────────────

const RECENT_KEY = 'search_recent_v1';
const MAX_RECENT = 8;
const DEBOUNCE_MS = 320;
const PAGE_SIZE = 20;
const PINK = '#FF4D8D';

const POPULAR_SEARCHES = ['Lipstick', 'Foundation', 'Mascara', 'Concealer', 'Blush', 'Highlighter', 'Eyeshadow', 'Serum'];

export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'best_sellers';

export type SearchFilters = {
  category: string | null;
  minPrice: string;
  maxPrice: string;
  minRating: number | null;
  inStock: boolean;
  newArrivals: boolean;
  bestSellers: boolean;
  onSale: boolean;
};

const DEFAULT_FILTERS: SearchFilters = {
  category: null,
  minPrice: '',
  maxPrice: '',
  minRating: null,
  inStock: false,
  newArrivals: false,
  bestSellers: false,
  onSale: false,
};

// ─── Storage helpers ──────────────────────────────────────────────────────────

async function loadRecentSearches(): Promise<string[]> {
  try {
    if (Platform.OS === 'web') {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(RECENT_KEY) : null;
      return raw ? JSON.parse(raw) : [];
    }
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveRecentSearches(searches: string[]) {
  try {
    const json = JSON.stringify(searches.slice(0, MAX_RECENT));
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(RECENT_KEY, json);
    } else {
      await AsyncStorage.setItem(RECENT_KEY, json);
    }
  } catch {}
}

async function addRecentSearch(term: string) {
  const prev = await loadRecentSearches();
  const next = [term, ...prev.filter(s => s.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT);
  await saveRecentSearches(next);
  return next;
}

async function clearRecentSearches() {
  try {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(RECENT_KEY);
    } else {
      await AsyncStorage.removeItem(RECENT_KEY);
    }
  } catch {}
}

// ─── Supabase search query ────────────────────────────────────────────────────

async function searchProducts(
  query: string,
  filters: SearchFilters,
  sort: SortOption,
  language: string,
  page: number,
): Promise<Product[]> {
  const offset = page * PAGE_SIZE;
  const q = query.trim();

  let dbQuery = supabase
    .from('products')
    .select(`
      id, name, name_ar, name_es, name_de, price, compare_price,
      category, category_id, makeup_subcategory, image_url, main_image,
      rating, review_count, badge, is_featured, featured, stock, in_stock, status,
      slug, try_on_type, created_at,
      translation:product_translations!left(language, name, short_description)
    `)
    .eq('status', 'active');

  // Text search: OR across name variants, description, category, badge
  if (q.length > 0) {
    // Build an OR filter string for PostgREST
    const likeQ = `%${q}%`;
    dbQuery = dbQuery.or(
      `name.ilike.${likeQ},name_ar.ilike.${likeQ},description.ilike.${likeQ},category.ilike.${likeQ},badge.ilike.${likeQ}`
    );
  }

  // Filters
  if (filters.category) dbQuery = dbQuery.eq('category', filters.category);
  if (filters.minPrice !== '') {
    const n = parseFloat(filters.minPrice);
    if (!isNaN(n)) dbQuery = dbQuery.gte('price', n);
  }
  if (filters.maxPrice !== '') {
    const n = parseFloat(filters.maxPrice);
    if (!isNaN(n)) dbQuery = dbQuery.lte('price', n);
  }
  if (filters.minRating !== null) dbQuery = dbQuery.gte('rating', filters.minRating);
  if (filters.inStock) dbQuery = dbQuery.eq('in_stock', true);
  if (filters.bestSellers) dbQuery = dbQuery.or('is_featured.eq.true,badge.ilike.%BESTSELLER%');
  if (filters.onSale) dbQuery = dbQuery.not('compare_price', 'is', null);
  if (filters.newArrivals) {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    dbQuery = dbQuery.gte('created_at', cutoff);
  }

  // Sorting
  switch (sort) {
    case 'price_asc':    dbQuery = dbQuery.order('price', { ascending: true });  break;
    case 'price_desc':   dbQuery = dbQuery.order('price', { ascending: false }); break;
    case 'rating':       dbQuery = dbQuery.order('rating', { ascending: false }); break;
    case 'newest':       dbQuery = dbQuery.order('created_at', { ascending: false }); break;
    case 'best_sellers': dbQuery = dbQuery.order('review_count', { ascending: false }); break;
    default:
      if (q.length > 0) {
        // Relevance: featured first, then rating, then review count
        dbQuery = dbQuery
          .order('is_featured', { ascending: false })
          .order('rating', { ascending: false })
          .order('review_count', { ascending: false });
      } else {
        dbQuery = dbQuery.order('created_at', { ascending: false });
      }
  }

  dbQuery = dbQuery.range(offset, offset + PAGE_SIZE - 1);

  const { data, error } = await dbQuery;
  if (error || !data) return [];

  return data.map((row: any) => {
    const translations: any[] = Array.isArray(row.translation)
      ? row.translation : row.translation ? [row.translation] : [];
    const tr = translations.find(t => t.language === language)
      ?? translations.find(t => t.language === 'en') ?? null;
    return { ...row, translation: tr } as Product;
  });
}

async function getSuggestions(q: string, language: string): Promise<string[]> {
  if (q.trim().length < 2) return [];
  const likeQ = `%${q.trim()}%`;
  const { data } = await supabase
    .from('products')
    .select('name, name_ar')
    .eq('status', 'active')
    .or(`name.ilike.${likeQ},name_ar.ilike.${likeQ}`)
    .limit(6);
  if (!data) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data) {
    const n = (language === 'ar' || language === 'ckb') && row.name_ar ? row.name_ar : row.name;
    if (n && !seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); out.push(n); }
  }
  return out;
}

// ─── Highlight matching text ──────────────────────────────────────────────────

function HighlightText({ text, query, color, style }: { text: string; query: string; color: string; style?: any }) {
  if (!query.trim() || !text) return <Text style={style}>{text}</Text>;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase()
          ? <Text key={i} style={{ color, fontWeight: '800' }}>{part}</Text>
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterPanel({
  filters, setFilters, sort, setSort, categories, onClose, C, t, isRTL,
}: {
  filters: SearchFilters;
  setFilters: (f: SearchFilters) => void;
  sort: SortOption;
  setSort: (s: SortOption) => void;
  categories: Category[];
  onClose: () => void;
  C: any; t: any; isRTL: boolean;
}) {
  const [local, setLocal] = useState<SearchFilters>(filters);
  const [localSort, setLocalSort] = useState<SortOption>(sort);
  const { language } = useLanguage();

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'relevance',    label: t.searchSortRelevance ?? 'Relevance' },
    { value: 'price_asc',    label: t.searchSortPriceLow ?? 'Price: Low to High' },
    { value: 'price_desc',   label: t.searchSortPriceHigh ?? 'Price: High to Low' },
    { value: 'rating',       label: t.searchSortRating ?? 'Top Rated' },
    { value: 'newest',       label: t.searchSortNewest ?? 'Newest' },
    { value: 'best_sellers', label: t.searchSortBestSellers ?? 'Best Sellers' },
  ];

  const ratingOptions = [4, 3, 2];

  return (
    <View style={[fpStyles.panel, { backgroundColor: C.backgroundSecondary }]}>
      <View style={[fpStyles.handle, { backgroundColor: C.border }]} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={fpStyles.content}>

        {/* Sort */}
        <Text style={[fpStyles.sectionTitle, { color: C.textSecondary }]}>{t.searchSort ?? 'Sort'}</Text>
        <View style={fpStyles.sortRow}>
          {sortOptions.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[fpStyles.sortChip, { borderColor: C.border, backgroundColor: C.backgroundCard },
                localSort === opt.value && { borderColor: PINK, backgroundColor: 'rgba(255,77,141,0.1)' }]}
              onPress={() => setLocalSort(opt.value)}
              activeOpacity={0.8}
            >
              <Text style={[fpStyles.sortChipText, { color: localSort === opt.value ? PINK : C.textMuted }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category */}
        <Text style={[fpStyles.sectionTitle, { color: C.textSecondary }]}>{t.searchFilterCategory ?? 'Category'}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fpStyles.catRow}>
          {[null, ...categories].map((cat) => {
            const id = cat ? cat.slug : null;
            const label = cat ? (cat.translation?.name || cat.slug) : (t.searchAllCategories ?? 'All');
            const active = local.category === id;
            return (
              <TouchableOpacity
                key={id ?? '__all__'}
                style={[fpStyles.catChip, { borderColor: C.border, backgroundColor: C.backgroundCard },
                  active && { borderColor: PINK, backgroundColor: 'rgba(255,77,141,0.1)' }]}
                onPress={() => setLocal({ ...local, category: id })}
                activeOpacity={0.8}
              >
                <Text style={[fpStyles.sortChipText, { color: active ? PINK : C.textMuted }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Price range */}
        <Text style={[fpStyles.sectionTitle, { color: C.textSecondary }]}>{t.searchFilterPrice ?? 'Price Range'}</Text>
        <View style={fpStyles.priceRow}>
          <View style={[fpStyles.priceInput, { backgroundColor: C.backgroundInput, borderColor: C.border }]}>
            <TextInput
              style={[fpStyles.priceText, { color: C.textPrimary }]}
              value={local.minPrice}
              onChangeText={v => setLocal({ ...local, minPrice: v.replace(/[^0-9.]/g, '') })}
              placeholder={t.searchMin ?? 'Min'}
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
            />
          </View>
          <Text style={[fpStyles.priceDash, { color: C.textMuted }]}>—</Text>
          <View style={[fpStyles.priceInput, { backgroundColor: C.backgroundInput, borderColor: C.border }]}>
            <TextInput
              style={[fpStyles.priceText, { color: C.textPrimary }]}
              value={local.maxPrice}
              onChangeText={v => setLocal({ ...local, maxPrice: v.replace(/[^0-9.]/g, '') })}
              placeholder={t.searchMax ?? 'Max'}
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Rating */}
        <Text style={[fpStyles.sectionTitle, { color: C.textSecondary }]}>{t.searchFilterRating ?? 'Min Rating'}</Text>
        <View style={fpStyles.ratingRow}>
          {[null, ...ratingOptions].map(r => {
            const active = local.minRating === r;
            return (
              <TouchableOpacity
                key={r ?? 'any'}
                style={[fpStyles.ratingChip, { borderColor: C.border, backgroundColor: C.backgroundCard },
                  active && { borderColor: PINK, backgroundColor: 'rgba(255,77,141,0.1)' }]}
                onPress={() => setLocal({ ...local, minRating: r })}
                activeOpacity={0.8}
              >
                {r ? (
                  <View style={fpStyles.ratingChipInner}>
                    <Star size={11} color={active ? PINK : C.textMuted} fill={active ? PINK : 'transparent'} strokeWidth={2} />
                    <Text style={[fpStyles.sortChipText, { color: active ? PINK : C.textMuted }]}>{r}+</Text>
                  </View>
                ) : (
                  <Text style={[fpStyles.sortChipText, { color: active ? PINK : C.textMuted }]}>Any</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Toggle filters */}
        {([
          { key: 'inStock',     label: t.searchFilterInStock ?? 'In Stock Only' },
          { key: 'newArrivals', label: t.searchFilterNewArrivals ?? 'New Arrivals' },
          { key: 'bestSellers', label: t.searchFilterBestSellers ?? 'Best Sellers' },
          { key: 'onSale',      label: t.searchFilterOnSale ?? 'On Sale' },
        ] as { key: keyof SearchFilters; label: string }[]).map(({ key, label }) => {
          const active = !!local[key];
          return (
            <TouchableOpacity
              key={key}
              style={[fpStyles.toggleRow, { borderColor: C.borderLight }]}
              onPress={() => setLocal({ ...local, [key]: !local[key] })}
              activeOpacity={0.8}
            >
              <Text style={[fpStyles.toggleLabel, { color: C.textPrimary }]}>{label}</Text>
              <View style={[fpStyles.toggleBox, { borderColor: active ? PINK : C.border, backgroundColor: active ? PINK : 'transparent' }]}>
                {active && <Check size={12} color="#fff" strokeWidth={3} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Action buttons */}
      <View style={[fpStyles.actions, { borderTopColor: C.border }]}>
        <TouchableOpacity
          style={[fpStyles.resetBtn, { borderColor: C.border }]}
          onPress={() => { setLocal(DEFAULT_FILTERS); setLocalSort('relevance'); }}
          activeOpacity={0.8}
        >
          <Text style={[fpStyles.resetText, { color: C.textMuted }]}>{t.searchReset ?? 'Reset'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={fpStyles.applyBtn}
          onPress={() => { setFilters(local); setSort(localSort); onClose(); }}
          activeOpacity={0.8}
        >
          <Text style={fpStyles.applyText}>{t.searchApply ?? 'Apply'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const fpStyles = StyleSheet.create({
  panel: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  content: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 6 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catRow: { gap: 6, paddingVertical: 2 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1 },
  catChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1 },
  sortChipText: { fontSize: 11, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceDash: { fontSize: 14 },
  priceInput: { flex: 1, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  priceText: { fontSize: 13 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1 },
  ratingChipInner: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  toggleLabel: { fontSize: 13, fontWeight: '500' },
  toggleBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1 },
  resetBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.full, borderWidth: 1, alignItems: 'center' },
  resetText: { fontSize: 13, fontWeight: '600' },
  applyBtn: { flex: 2, paddingVertical: 12, borderRadius: Radius.full, backgroundColor: PINK, alignItems: 'center' },
  applyText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

// ─── Active filter chips strip ────────────────────────────────────────────────

function ActiveFiltersStrip({ filters, sort, onOpenPanel, C, t }: {
  filters: SearchFilters; sort: SortOption; onOpenPanel: () => void; C: any; t: any;
}) {
  const hasFilters = filters.category || filters.minPrice || filters.maxPrice ||
    filters.minRating || filters.inStock || filters.newArrivals ||
    filters.bestSellers || filters.onSale || sort !== 'relevance';

  const sortLabels: Record<SortOption, string> = {
    relevance: t.searchSortRelevance ?? 'Relevance',
    price_asc: t.searchSortPriceLow ?? 'Price ↑',
    price_desc: t.searchSortPriceHigh ?? 'Price ↓',
    rating: t.searchSortRating ?? 'Top Rated',
    newest: t.searchSortNewest ?? 'Newest',
    best_sellers: t.searchSortBestSellers ?? 'Best Sellers',
  };

  return (
    <TouchableOpacity
      style={[afStyles.bar, { borderBottomColor: C.border, backgroundColor: C.backgroundSecondary }]}
      onPress={onOpenPanel}
      activeOpacity={0.85}
    >
      <SlidersHorizontal size={14} color={hasFilters ? PINK : C.textMuted} strokeWidth={2} />
      <Text style={[afStyles.label, { color: hasFilters ? PINK : C.textMuted }]}>
        {t.searchFilters ?? 'Filters'} · {sortLabels[sort]}
      </Text>
      <ChevronDown size={13} color={hasFilters ? PINK : C.textMuted} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const afStyles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: 1 },
  label: { flex: 1, fontSize: 12, fontWeight: '600' },
});

// ─── Main SearchModal ─────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
  initialQuery?: string;
};

export default function SearchModal({ visible, onClose, initialQuery = '' }: Props) {
  const C = useAppColors();
  const { t, language, isRTL } = useLanguage();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [pageRef, setPageRef] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortOption>('relevance');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const numCols = width >= 768 ? 3 : 2;
  const SIDE_PAD = 8;
  const GAP = 6;
  const cardW = (width - SIDE_PAD * 2 - GAP * (numCols - 1)) / numCols;

  // Load recent + categories when opened
  useEffect(() => {
    if (!visible) return;
    loadRecentSearches().then(setRecent);
    fetchCategories(language).then(setCategories).catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [visible]);

  // Debounce query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Fetch suggestions while typing (before submit)
  useEffect(() => {
    if (debouncedQuery.trim().length < 2) { setSuggestions([]); return; }
    getSuggestions(debouncedQuery, language).then(setSuggestions);
  }, [debouncedQuery, language]);

  // Run full search when query/filters/sort change
  const runSearch = useCallback(async (q: string, f: SearchFilters, s: SortOption, page: number, append: boolean) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    setHasSearched(true);
    try {
      const data = await searchProducts(q, f, s, language, page);
      setResults(prev => append ? [...prev, ...data] : data);
      setHasMore(data.length === PAGE_SIZE);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [language]);

  // Trigger search when debouncedQuery/filters/sort change
  useEffect(() => {
    if (debouncedQuery.trim().length === 0 && !hasSearched) return;
    setPageRef(0);
    runSearch(debouncedQuery, filters, sort, 0, false);
  }, [debouncedQuery, filters, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async () => {
    if (query.trim().length === 0) return;
    setSuggestions([]);
    const next = await addRecentSearch(query.trim());
    setRecent(next);
    setPageRef(0);
    runSearch(query.trim(), filters, sort, 0, false);
  }, [query, filters, sort, runSearch]);

  const handleSuggestionPress = useCallback((term: string) => {
    setQuery(term);
    setSuggestions([]);
    addRecentSearch(term).then(setRecent);
    setPageRef(0);
    runSearch(term, filters, sort, 0, false);
  }, [filters, sort, runSearch]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    const next = pageRef + 1;
    setPageRef(next);
    runSearch(debouncedQuery, filters, sort, next, true);
  }, [loadingMore, hasMore, loading, pageRef, debouncedQuery, filters, sort, runSearch]);

  const handleClearRecent = useCallback(async () => {
    await clearRecentSearches();
    setRecent([]);
  }, []);

  const showSuggestions = suggestions.length > 0 && query.trim().length >= 2;
  const showEmpty = hasSearched && !loading && debouncedQuery.trim().length > 0 && results.length === 0;
  const showResults = hasSearched && (results.length > 0 || loading);
  const showHomeState = !hasSearched || debouncedQuery.trim().length === 0;

  const resultHeader = useMemo(() => {
    if (!showResults) return null;
    const label = debouncedQuery.trim()
      ? `${t.searchResultsFor ?? 'Results for'} "${debouncedQuery.trim()}"`
      : t.searchResults ?? 'Results';
    return (
      <View style={[rhStyles.wrap, { borderBottomColor: C.border }]}>
        <Text style={[rhStyles.text, { color: C.textSecondary }]}>{label}</Text>
        {loading && <ActivityIndicator size="small" color={PINK} style={{ marginLeft: 8 }} />}
      </View>
    );
  }, [showResults, debouncedQuery, loading, t, C]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[smStyles.root, { backgroundColor: C.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Search input row ── */}
        <View style={[smStyles.inputRow, { backgroundColor: C.background, borderBottomColor: C.border }]}>
          <View style={[smStyles.inputWrap, { backgroundColor: C.backgroundInput, borderColor: C.border }]}>
            <Search size={16} color={C.textMuted} strokeWidth={2} />
            <TextInput
              ref={inputRef}
              style={[smStyles.input, { color: C.textPrimary, textAlign: isRTL ? 'right' : 'left' }]}
              value={query}
              onChangeText={setQuery}
              placeholder={(t as any).searchPlaceholderFull ?? 'Search products, shades, categories...'}
              placeholderTextColor={C.textMuted}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSubmit}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setSuggestions([]); setHasSearched(false); setResults([]); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <X size={15} color={C.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={smStyles.cancelBtn} activeOpacity={0.75}>
            <Text style={[smStyles.cancelText, { color: PINK }]}>{t.cancel ?? 'Cancel'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Suggestions dropdown ── */}
        {showSuggestions && (
          <View style={[smStyles.suggestions, { backgroundColor: C.backgroundCard, borderColor: C.border }]}>
            {suggestions.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={[smStyles.suggRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.borderLight }]}
                onPress={() => handleSuggestionPress(s)}
                activeOpacity={0.8}
              >
                <Search size={12} color={C.textMuted} strokeWidth={2} />
                <HighlightText text={s} query={query} color={PINK} style={[smStyles.suggText, { color: C.textPrimary }]} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Filters bar (only when showing results) ── */}
        {showResults && (
          <ActiveFiltersStrip filters={filters} sort={sort} onOpenPanel={() => setShowFilterPanel(true)} C={C} t={t} />
        )}

        {/* ── Home state: recent + popular ── */}
        {showHomeState && !showSuggestions && (
          <ScrollView contentContainerStyle={[smStyles.homeContent, { paddingBottom: 40 }]} showsVerticalScrollIndicator={false}>
            {recent.length > 0 && (
              <View style={smStyles.section}>
                <View style={smStyles.sectionHeader}>
                  <View style={smStyles.sectionTitleRow}>
                    <Clock size={13} color={C.textMuted} strokeWidth={2} />
                    <Text style={[smStyles.sectionTitle, { color: C.textSecondary }]}>
                      {(t as any).searchRecent ?? 'Recent Searches'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleClearRecent} activeOpacity={0.7}>
                    <Text style={[smStyles.clearText, { color: PINK }]}>{(t as any).searchClearAll ?? 'Clear all'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={smStyles.pillWrap}>
                  {recent.map((r, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[smStyles.pill, { backgroundColor: C.backgroundCard, borderColor: C.border }]}
                      onPress={() => handleSuggestionPress(r)}
                      activeOpacity={0.8}
                    >
                      <Clock size={10} color={C.textMuted} strokeWidth={2} />
                      <Text style={[smStyles.pillText, { color: C.textPrimary }]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={smStyles.section}>
              <View style={smStyles.sectionTitleRow}>
                <TrendingUp size={13} color={PINK} strokeWidth={2} />
                <Text style={[smStyles.sectionTitle, { color: C.textSecondary }]}>
                  {(t as any).searchPopular ?? 'Popular Searches'}
                </Text>
              </View>
              <View style={smStyles.pillWrap}>
                {POPULAR_SEARCHES.map((p, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[smStyles.pill, { backgroundColor: 'rgba(255,77,141,0.08)', borderColor: 'rgba(255,77,141,0.25)' }]}
                    onPress={() => handleSuggestionPress(p)}
                    activeOpacity={0.8}
                  >
                    <TrendingUp size={10} color={PINK} strokeWidth={2} />
                    <Text style={[smStyles.pillText, { color: PINK }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        )}

        {/* ── No results ── */}
        {showEmpty && (
          <View style={smStyles.emptyWrap}>
            <Search size={48} color={C.textMuted} strokeWidth={1.2} />
            <Text style={[smStyles.emptyTitle, { color: C.textPrimary }]}>
              {(t as any).searchNoResults ?? 'No results found'}
            </Text>
            <Text style={[smStyles.emptySub, { color: C.textMuted }]}>
              {(t as any).searchNoResultsSub ?? 'Try different keywords or remove filters'}
            </Text>
          </View>
        )}

        {/* ── Results grid ── */}
        {showResults && (
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            numColumns={numCols}
            key={`search-cols-${numCols}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[smStyles.grid, { padding: SIDE_PAD, gap: GAP }]}
            columnWrapperStyle={numCols > 1 ? { gap: GAP } : undefined}
            ListHeaderComponent={resultHeader}
            initialNumToRender={numCols * 4}
            maxToRenderPerBatch={numCols * 3}
            windowSize={7}
            removeClippedSubviews
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={PINK} style={{ paddingVertical: 20 }} /> : null}
            renderItem={({ item }) => (
              <View style={{ flex: 1, maxWidth: cardW }}>
                <ProductCard product={item} />
              </View>
            )}
          />
        )}

        {/* ── Skeleton while loading first page ── */}
        {loading && !loadingMore && results.length === 0 && (
          <SearchResultsSkeleton />
        )}
      </KeyboardAvoidingView>

      {/* ── Filter panel sheet ── */}
      {showFilterPanel && (
        <Pressable style={smStyles.sheetBackdrop} onPress={() => setShowFilterPanel(false)}>
          <Pressable onPress={e => e.stopPropagation()}>
            <FilterPanel
              filters={filters}
              setFilters={(f) => { setFilters(f); }}
              sort={sort}
              setSort={(s) => { setSort(s); }}
              categories={categories}
              onClose={() => setShowFilterPanel(false)}
              C={C}
              t={t}
              isRTL={isRTL}
            />
          </Pressable>
        </Pressable>
      )}
    </Modal>
  );
}

const smStyles = StyleSheet.create({
  root: { flex: 1 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'ios' ? 52 : 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  input: { flex: 1, fontSize: 14, padding: 0, margin: 0 },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  cancelText: { fontSize: 14, fontWeight: '600' },

  suggestions: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 116 : 74,
    left: 12,
    right: 12,
    zIndex: 100,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  suggRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  suggText: { flex: 1, fontSize: 13, fontWeight: '500' },

  homeContent: { paddingHorizontal: 16, paddingTop: 20, gap: 24 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  clearText: { fontSize: 12, fontWeight: '600' },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '600' },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },

  grid: { paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sheetBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    zIndex: 200,
  },
});

const rhStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  text: { fontSize: 12, fontWeight: '600', flex: 1 },
});
