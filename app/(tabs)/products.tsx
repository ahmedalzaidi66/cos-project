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
  I18nManager,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ShoppingBag, ChevronRight, Star, Check } from 'lucide-react-native';
import { fetchProducts, fetchCategories, getProductName, getProductImage, getCategoryName, Product, Category } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { useCart } from '@/context/CartContext';
import AppHeader from '@/components/AppHeader';
import StarRating from '@/components/StarRating';
import WishlistHeart from '@/components/WishlistHeart';
import { useWishlistToast } from '@/context/WishlistToastContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';

type MakeupSubcategory = 'lips' | 'face' | 'eye' | 'nail';

const MAKEUP_SUBCATEGORY_LABELS: Record<MakeupSubcategory, string> = {
  lips: 'Lips',
  face: 'Face',
  eye: 'Eye',
  nail: 'Nail',
};

const MAKEUP_SUBCATEGORIES = Object.keys(MAKEUP_SUBCATEGORY_LABELS) as MakeupSubcategory[];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ProductsScreen() {
  const router = useRouter();
  const { category: categoryParam } = useLocalSearchParams<{ category?: string }>();
  const { language, t } = useLanguage();
  const { width } = useWindowDimensions();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam ?? null);
  const [selectedMakeupSub, setSelectedMakeupSub] = useState<MakeupSubcategory | null>(null);
  const [loading, setLoading] = useState(true);

  const isMakeup = selectedCategory === 'makeup';

  // When nav param changes (e.g. opened from drawer), sync the filter
  useEffect(() => {
    setSelectedCategory(categoryParam ?? null);
    setSelectedMakeupSub(null);
  }, [categoryParam]);

  const loadedFor = useRef({ language: '', category: selectedCategory, makeupSub: selectedMakeupSub });

  const load = useCallback(async () => {
    const fetchLang = language;
    const fetchCat = selectedCategory;
    const fetchMakeupSub = selectedMakeupSub;
    setLoading(true);
    setProducts([]);
    try {
      const [prods, cats] = await Promise.all([
        fetchProducts({
          language: fetchLang,
          category: fetchCat ?? undefined,
          makeup_subcategory: fetchCat === 'makeup' && fetchMakeupSub ? fetchMakeupSub : undefined,
        }),
        fetchCategories(fetchLang),
      ]);
      // Discard if state changed while fetch was in-flight
      if (
        loadedFor.current.language !== fetchLang ||
        loadedFor.current.category !== fetchCat ||
        loadedFor.current.makeupSub !== fetchMakeupSub
      ) return;
      setProducts(prods);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, [language, selectedCategory, selectedMakeupSub]);

  useEffect(() => {
    loadedFor.current = { language, category: selectedCategory, makeupSub: selectedMakeupSub };
    load();
  }, [load, language, selectedCategory, selectedMakeupSub]);

  const numCols = width >= 768 ? 3 : 2;
  const SIDE_PAD = 8;
  const GAP = 6;
  const cardW = (width - SIDE_PAD * 2 - GAP * (numCols - 1)) / numCols;

  const activeLabel = useMemo(() => {
    if (!selectedCategory) return 'All Products';
    const cat = categories.find(c => c.slug === selectedCategory);
    return cat ? getCategoryName(cat, language) : capitalize(selectedCategory);
  }, [selectedCategory, categories, language]);

  return (
    <View style={styles.container}>
      <AppHeader title={activeLabel} showBack />

      {/* Category filter chips */}
      <View style={styles.filterWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[null, ...categories.map(c => c.slug)]}
          keyExtractor={item => item ?? '__all__'}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item }) => {
            const active = item === selectedCategory;
            const cat = item === null ? null : categories.find(c => c.slug === item);
            const label = item === null ? 'All' : (cat ? getCategoryName(cat, language) : capitalize(item));
            return (
              <TouchableOpacity
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => { setSelectedCategory(item); setSelectedMakeupSub(null); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
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
              <Text style={[styles.subChipText, selectedMakeupSub === null && styles.subChipTextActive]}>All</Text>
            </TouchableOpacity>
            {MAKEUP_SUBCATEGORIES.map(sub => (
              <TouchableOpacity
                key={sub}
                style={[styles.subChip, selectedMakeupSub === sub && styles.subChipActive]}
                onPress={() => setSelectedMakeupSub(sub)}
                activeOpacity={0.75}
              >
                <Text style={[styles.subChipText, selectedMakeupSub === sub && styles.subChipTextActive]}>
                  {MAKEUP_SUBCATEGORY_LABELS[sub]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.neonBlue} />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyWrap}>
          <ShoppingBag size={52} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyText}>No products found</Text>
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
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              cardW={cardW}
              language={language}
              onPress={() => router.push(`/product/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

const ProductCard = memo(function ProductCard({
  product, cardW, language, onPress,
}: {
  product: Product; cardW: number; language: string; onPress: () => void;
}) {
  const { addToCart } = useCart();
  const { showCartToast } = useWishlistToast();
  const [justAdded, setJustAdded] = React.useState(false);
  const imgH = Math.round(cardW * 0.62);
  const imgUri = getProductImage(product) || undefined;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardW }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.cardImageWrap, { height: imgH }]}>
        <Image
          source={imgUri ? { uri: imgUri } : undefined}
          style={styles.cardImage}
          resizeMode="cover"
        />
        {product.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{product.badge}</Text>
          </View>
        )}
        <WishlistHeart product={product} size={13} variant="card" />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={2}>
          {getProductName(product, language)}
        </Text>
        <StarRating rating={product.rating} reviewCount={product.review_count} size={10} showCount />
        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>{formatPrice(product.price, language)}</Text>
          <TouchableOpacity
            style={[styles.cartBtn, justAdded && styles.cartBtnAdded]}
            activeOpacity={0.85}
            onPress={(e) => {
              const nativeEv = e?.nativeEvent as any;
              if (nativeEv?.stopPropagation) nativeEv.stopPropagation();
              if (nativeEv?.preventDefault) nativeEv.preventDefault();
              addToCart(product);
              showCartToast('Added to cart');
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

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
    color: Colors.background,
    fontWeight: '700',
  },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  viewBtn: {
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  viewBtnText: {
    color: Colors.background,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
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
});
