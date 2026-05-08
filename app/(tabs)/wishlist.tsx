import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, ShoppingCart, Trash2, ArrowLeft, X } from 'lucide-react-native';
import { useWishlist, WishlistItem } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getProductName, getProductImage } from '@/lib/supabase';
import AppHeader from '@/components/AppHeader';
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';

export default function WishlistScreen() {
  const { isAuthenticated } = useAuth();
  const { wishlistItems, loading, remove, clearAll, count } = useWishlist();
  const { addToCart, items: cartItems } = useCart();
  const { t, language } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const handleMoveToCart = useCallback(
    (item: WishlistItem) => {
      const alreadyInCart = cartItems.some((c) => c.product.id === item.product.id);
      if (!alreadyInCart) {
        addToCart(item.product, 1);
      }
      remove(item.product.id);
    },
    [addToCart, remove, cartItems]
  );

  const handleClearAll = useCallback(() => {
    Alert.alert(
      t.clearWishlist ?? 'Clear Wishlist',
      t.clearWishlistConfirm ?? 'Remove all items from your wishlist?',
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.clearAll ?? 'Clear All',
          style: 'destructive',
          onPress: () => clearAll(),
        },
      ]
    );
  }, [clearAll, t]);

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <AppHeader title={t.myWishlist ?? 'My Wishlist'} />
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Heart size={52} color={Colors.textMuted} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{t.signInToSave ?? 'Sign in to save favorites'}</Text>
          <Text style={styles.emptySubtitle}>
            {t.signInToSaveDesc ?? 'Create an account to save products and access your wishlist from any device.'}
          </Text>
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => router.push('/(tabs)/account' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.signInBtnText}>{t.signIn ?? 'Sign In'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title={t.myWishlist ?? 'My Wishlist'} showBack />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.neonBlue} size="large" />
        </View>
      ) : wishlistItems.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Heart size={52} color={Colors.textMuted} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{t.wishlistEmpty ?? 'Your wishlist is empty'}</Text>
          <Text style={styles.emptySubtitle}>
            {t.wishlistEmptyDesc ?? 'Tap the heart icon on any product to save it here.'}
          </Text>
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => router.push('/(tabs)/products' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.signInBtnText}>{t.browseProducts ?? 'Browse Products'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Header row with count + clear button */}
          <View style={styles.listHeader}>
            <Text style={styles.listCount}>
              {count} {count === 1 ? (t.item ?? 'item') : (t.items ?? 'items')}
            </Text>
            <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7} style={styles.clearBtn}>
              <Trash2 size={14} color={Colors.error} strokeWidth={2} />
              <Text style={styles.clearBtnText}>{t.clearAll ?? 'Clear All'}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          >
            {wishlistItems.map((item) => (
              <WishlistCard
                key={item.id}
                item={item}
                language={language}
                onAddToCart={() => handleMoveToCart(item)}
                onRemove={() => remove(item.product.id)}
                onView={() => router.push(`/product/${item.product.id}` as any)}
                screenWidth={width}
              />
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      )}
    </View>
  );
}

function WishlistCard({
  item,
  language,
  onAddToCart,
  onRemove,
  onView,
  screenWidth,
}: {
  item: WishlistItem;
  language: string;
  onAddToCart: () => void;
  onRemove: () => void;
  onView: () => void;
  screenWidth: number;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const { t } = useLanguage();

  const animateOut = useCallback(
    (cb: () => void) => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -60,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => cb());
    },
    [slideAnim, opacityAnim]
  );

  const handleRemove = useCallback(() => {
    animateOut(onRemove);
  }, [onRemove, animateOut]);

  const handleCartMove = useCallback(() => {
    animateOut(onAddToCart);
  }, [onAddToCart, animateOut]);

  const product = item.product;
  const imageUri = getProductImage(product);
  const name = getProductName(product, language);
  const isCompact = screenWidth < 400;

  return (
    <Animated.View
      style={[
        styles.card,
        { transform: [{ translateX: slideAnim }], opacity: opacityAnim },
      ]}
    >
      {/* Product image */}
      <TouchableOpacity onPress={onView} activeOpacity={0.9} style={styles.cardImageWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
        )}
        {product.badge && (
          <View style={styles.cardBadge}>
            <Text style={styles.cardBadgeText}>{product.badge}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Product info */}
      <TouchableOpacity style={styles.cardInfo} onPress={onView} activeOpacity={0.9}>
        <Text style={styles.cardCategory}>{product.category?.toUpperCase()}</Text>
        <Text style={styles.cardName} numberOfLines={2}>{name}</Text>
        <View style={styles.cardPriceRow}>
          <Text style={styles.cardPrice}>{formatPrice(product.price, language)}</Text>
          {product.compare_price != null && product.compare_price > product.price && (
            <Text style={styles.cardCompare}>{formatPrice(product.compare_price, language)}</Text>
          )}
        </View>
        {product.stock === 0 && (
          <Text style={styles.outOfStock}>{t.outOfStock ?? 'Out of Stock'}</Text>
        )}
      </TouchableOpacity>

      {/* Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[
            styles.actionBtn,
            styles.cartBtn,
            product.stock === 0 && styles.actionBtnDisabled,
          ]}
          onPress={handleCartMove}
          disabled={product.stock === 0}
          activeOpacity={0.8}
        >
          <ShoppingCart size={16} color={product.stock === 0 ? Colors.textMuted : Colors.background} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.removeBtn]}
          onPress={handleRemove}
          activeOpacity={0.8}
        >
          <X size={16} color={Colors.error} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  signInBtn: {
    backgroundColor: Colors.neonBlue,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    borderRadius: Radius.full,
  },
  signInBtnText: {
    color: Colors.background,
    fontSize: FontSize.md,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  listCount: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  clearBtnText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Shadow.card,
  },
  cardImageWrap: {
    position: 'relative',
    width: 72,
    height: 80,
    flexShrink: 0,
  },
  cardImage: {
    width: 72,
    height: 80,
    backgroundColor: Colors.backgroundSecondary,
  },
  cardImagePlaceholder: {
    backgroundColor: Colors.backgroundSecondary,
  },
  cardBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.xs,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  cardBadgeText: {
    color: Colors.white,
    fontSize: 8,
    fontWeight: '800',
  },
  cardInfo: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: 2,
  },
  cardCategory: {
    color: Colors.neonBlue,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cardName: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  cardPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 1,
  },
  cardPrice: {
    color: Colors.neonBlue,
    fontSize: 12,
    fontWeight: '800',
  },
  cardCompare: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  outOfStock: {
    color: Colors.warning,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  cardActions: {
    flexDirection: 'column',
    gap: 4,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  cartBtn: {
    backgroundColor: Colors.neonBlue,
    borderColor: Colors.neonBlue,
  },
  removeBtn: {
    backgroundColor: Colors.error + '15',
    borderColor: Colors.error + '40',
  },
  actionBtnDisabled: {
    backgroundColor: Colors.backgroundSecondary,
    borderColor: Colors.border,
  },
});
