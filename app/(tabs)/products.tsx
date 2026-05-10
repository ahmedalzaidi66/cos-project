import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ShoppingBag, Check, Search } from 'lucide-react-native';
import SearchModal from '@/components/SearchModal';
import { ProductGridSkeleton } from '@/components/Skeleton';
import { fetchProducts, fetchCategories, getProductName, getProductImage, getCategoryName, Product, Category } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import AppHeader from '@/components/AppHeader';
import StarRating from '@/components/StarRating';
import WishlistHeart from '@/components/WishlistHeart';
import { useWishlistToast } from '@/context/WishlistToastContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { useAppColors, useThemeMode } from '@/context/ThemeContext';
import { formatPrice } from '@/lib/currency';

const PAGE_SIZE = 24;

type MakeupSubcategory = 'lips' | 'face' | 'eye' | 'nail';

const MAKEUP_SUBCATEGORIES: MakeupSubcategory[] = ['lips', 'face', 'eye', 'nail'];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}


// ─── Product card (inline, memoized) ─────────────────────────────────────────

const ProductCard = memo(function ProductCard({
  product, cardW, language, t, cardBg, imageWrapBg, textColor, onPress,
}: {
  product: Product; cardW: number; language: string; t: any;
  cardBg?: string; imageWrapBg?: string; textColor?: string;
  onPress: () => void;
}) {
  const { addToCart } = useCart();
  const { showCartToast } = useWishlistToast();
  const [justAdded, setJustAdded] = React.useState(false);
  const imgH = Math.round(cardW * 0.62);
  const imgUri = getProductImage(product) || undefined;
  const isOOS = product.in_stock === false || product.stock === 0;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardW }, cardBg ? { backgroundColor: cardBg } : undefined]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.cardImageWrap, { height: imgH }, imageWrapBg ? { backgroundColor: imageWrapBg } : undefined]}>
        <Image
          source={imgUri ? { uri: imgUri } : undefined}
          style={[styles.cardImage, isOOS && { opacity: 0.5 }]}
          resizeMode="cover"
          fadeDuration={200}
        />
        {isOOS ? (
          <View style={[styles.badge, styles.oosBadge]}>
            <Text style={styles.badgeText}>{t.outOfStock2}</Text>
          </View>
        ) : product.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{product.badge}</Text>
          </View>
        ) : null}
        <WishlistHeart product={product} size={13} variant="card" />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardName, textColor ? { color: textColor } : undefined]} numberOfLines={2}>
          {getProductName(product, language)}
        </Text>
        <StarRating rating={product.rating} reviewCount={product.review_count} size={10} showCount />
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>{formatPrice(product.price, language)}</Text>
          <TouchableOpacity
            style={[styles.cartBtn, justAdded && styles.cartBtnAdded, isOOS && styles.cartBtnOOS]}
            activeOpacity={isOOS ? 1 : 0.85}
            onPress={(e) => {
              const nativeEv = e?.nativeEvent as any;
              if (nativeEv?.stopPropagation) nativeEv.stopPropagation();
              if (nativeEv?.preventDefault) nativeEv.preventDefault();
              if (isOOS) { showCartToast(t.outOfStockToast); return; }
              addToCart(product);
              showCartToast(t.addedToCartToast);
              setJustAdded(true);
              setTimeout(() => setJustAdded(false), 1000);
            }}
          >
            {justAdded
              ? <Check size={11} color="#FFFFFF" strokeWidth={2.5} />
              : <ShoppingBag size={11} color="#FFFFFF" strokeWidth={2.5} />
            }
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProductsScreen() {
  const router = useRouter();
  const { category: categoryParam } = useLocalSearchParams<{ category?: string }>();
  const { language, t } = useLanguage();
  const C = useAppColors();
  const themeMode = useThemeMode();
  const { width } = useWindowDimensions();

  useEffect(() => {
    console.log('[Shop] active theme mode =', themeMode, '| background =', C.background);
  }, [themeMode]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam ?? null);
  const [selectedMakeupSub, setSelectedMakeupSub] = useState<MakeupSubcategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);

  const isMakeup = selectedCategory === 'makeup';

  const numCols = width >= 768 ? 3 : 2;
  const SIDE_PAD = 8;
  const GAP = 6;
  const cardW = (width - SIDE_PAD * 2 - GAP * (numCols - 1)) / numCols;

  // When nav param changes, sync the filter
  useEffect(() => {
    setSelectedCategory(categoryParam ?? null);
    setSelectedMakeupSub(null);
  }, [categoryParam]);

  // Stale-request guard
  const loadedFor = useRef({ language: '', category: selectedCategory, makeupSub: selectedMakeupSub });

  const loadPage = useCallback(async (page: number, replace: boolean) => {
    const fetchLang = language;
    const fetchCat = selectedCategory;
    const fetchMakeupSub = selectedMakeupSub;

    if (replace) setLoading(true);
    else setLoadingMore(true);

    try {
      const [prods, cats] = await Promise.all([
        fetchProducts({
          language: fetchLang,
          category: fetchCat ?? undefined,
          makeup_subcategory: fetchCat === 'makeup' && fetchMakeupSub ? fetchMakeupSub : undefined,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }),
        page === 0 ? fetchCategories(fetchLang) : Promise.resolve(null),
      ]);

      // Discard if state changed while fetch was in-flight
      if (
        loadedFor.current.language !== fetchLang ||
        loadedFor.current.category !== fetchCat ||
        loadedFor.current.makeupSub !== fetchMakeupSub
      ) return;

      setProducts((prev) => replace ? prods : [...prev, ...prods]);
      if (cats) setCategories(cats);
      setHasMore(prods.length === PAGE_SIZE);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [language, selectedCategory, selectedMakeupSub]);

  // Reset and reload when filters change
  useEffect(() => {
    loadedFor.current = { language, category: selectedCategory, makeupSub: selectedMakeupSub };
    pageRef.current = 0;
    setProducts([]);
    setHasMore(true);
    loadPage(0, true);
  }, [loadPage, language, selectedCategory, selectedMakeupSub]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    loadPage(nextPage, false);
  }, [loadingMore, hasMore, loading, loadPage]);

  const activeLabel = useMemo(() => {
    if (!selectedCategory) return t.allProducts;
    const cat = categories.find(c => c.slug === selectedCategory);
    return cat ? getCategoryName(cat, language) : capitalize(selectedCategory);
  }, [selectedCategory, categories, language, t]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.neonBlue} />
      </View>
    );
  }, [loadingMore]);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <AppHeader title={activeLabel} showBack />

      {/* Search tap bar */}
      <TouchableOpacity
        style={[styles.searchTapBar, { backgroundColor: C.backgroundInput, borderColor: C.border }]}
        onPress={() => setSearchOpen(true)}
        activeOpacity={0.85}
      >
        <Search size={15} color={C.textMuted} strokeWidth={2} />
        <Text style={[styles.searchTapText, { color: C.textMuted }]}>
          {t.searchGear ?? 'Search beauty...'}
        </Text>
      </TouchableOpacity>

      {/* Category filter chips */}
      <View style={[styles.filterWrap, { backgroundColor: C.backgroundSecondary, borderBottomColor: C.border }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[null, ...categories.map(c => c.slug)]}
          keyExtractor={item => item ?? '__all__'}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => {
            const active = item === selectedCategory;
            const cat = item === null ? null : categories.find(c => c.slug === item);
            const label = item === null ? t.allLabel : (cat ? getCategoryName(cat, language) : capitalize(item ?? ''));
            return (
              <TouchableOpacity
                style={[styles.chip, { borderColor: C.border }, active && styles.chipActive]}
                onPress={() => { setSelectedCategory(item); setSelectedMakeupSub(null); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, { color: C.textSecondary }, active && styles.chipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
        {isMakeup && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.subFilterContent}
          >
            <TouchableOpacity
              style={[styles.subChip, selectedMakeupSub === null && styles.subChipActive]}
              onPress={() => setSelectedMakeupSub(null)}
              activeOpacity={0.75}
            >
              <Text style={[styles.subChipText, selectedMakeupSub === null && styles.subChipTextActive]}>{t.allLabel}</Text>
            </TouchableOpacity>
            {MAKEUP_SUBCATEGORIES.map(sub => {
              const subLabel: Record<MakeupSubcategory, string> = {
                lips: t.subCatLips,
                face: t.subCatFace,
                eye:  t.subCatEye,
                nail: t.subCatNail,
              };
              return (
                <TouchableOpacity
                  key={sub}
                  style={[styles.subChip, selectedMakeupSub === sub && styles.subChipActive]}
                  onPress={() => setSelectedMakeupSub(sub)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.subChipText, selectedMakeupSub === sub && styles.subChipTextActive]}>
                    {subLabel[sub]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {loading ? (
        <ProductGridSkeleton count={numCols * 3} numCols={numCols} imageHeight={Math.round(cardW * 0.62)} />
      ) : products.length === 0 ? (
        <View style={styles.emptyWrap}>
          <ShoppingBag size={52} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyText}>{t.noProductsFound2}</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.id}
          numColumns={numCols}
          key={`cols-${numCols}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.grid, { padding: SIDE_PAD, gap: GAP }]}
          columnWrapperStyle={numCols > 1 ? { gap: GAP } : undefined}
          initialNumToRender={numCols * 4}
          maxToRenderPerBatch={numCols * 3}
          windowSize={7}
          removeClippedSubviews
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              cardW={cardW}
              language={language}
              t={t}
              cardBg={C.backgroundCard}
              imageWrapBg={C.backgroundInput}
              textColor={C.textPrimary}
              onPress={() => router.push(`/product/${item.id}`)}
            />
          )}
        />
      )}

      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchTapBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 2,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  searchTapText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
  },

  filterWrap: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  filterContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 5,
  },
  subFilterContent: {
    paddingHorizontal: 8,
    paddingBottom: 6,
    gap: 4,
  },
  subChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.25)',
    backgroundColor: 'transparent',
  },
  subChipActive: {
    backgroundColor: 'rgba(255,77,141,0.15)',
    borderColor: Colors.neonBlue,
  },
  subChipText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  subChipTextActive: {
    color: Colors.neonBlue,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: Colors.neonBlue,
    borderColor: Colors.neonBlue,
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.md },

  grid: { paddingBottom: 16 },

  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 6,
  },
  cardImageWrap: {
    width: '100%',
    backgroundColor: '#140A10',
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.sm,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  oosBadge: {
    backgroundColor: 'rgba(60,20,20,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.5)',
  },
  badgeText: {
    color: Colors.background,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardBody: { padding: 6, gap: 2 },
  cardName: {
    color: Colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardPrice: {
    color: Colors.neonBlue,
    fontSize: 11,
    fontWeight: '900',
  },
  cartBtn: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: Colors.neonBlueDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBtnAdded: {
    backgroundColor: '#1a7a45',
  },
  cartBtnOOS: {
    backgroundColor: 'rgba(80,40,40,0.6)',
    opacity: 0.65,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
