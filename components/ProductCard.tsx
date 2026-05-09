import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingCart, Check } from 'lucide-react-native';
import { Product, ProductShade, getProductName, getProductImage, fetchProductShades } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import StarRating from './StarRating';
import WishlistHeart from './WishlistHeart';
import { Colors, Radius, Spacing, FontSize, Shadow } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';
import { useUISize } from '@/context/UISizeContext';
import { useWishlistToast } from '@/context/WishlistToastContext';

type Props = {
  product: Product;
  onWishlistLoginRequired?: () => void;
};

function ProductCardComponent({ product, onWishlistLoginRequired }: Props) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { language, isRTL } = useLanguage();
  const { productCardSizes, globalSizes } = useUISize();
  const { showCartToast } = useWishlistToast();
  const [shades, setShades] = useState<ProductShade[]>([]);
  const [activeShade, setActiveShade] = useState<ProductShade | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // Defer shade fetch by one frame so the card renders immediately
    const timer = setTimeout(() => {
      fetchProductShades(product.id)
        .then((s) => { if (mounted.current) setShades(s ?? []); })
        .catch(() => { if (mounted.current) setShades([]); });
    }, 0);
    return () => {
      mounted.current = false;
      clearTimeout(timer);
    };
  }, [product.id]);

  const displayImage = activeShade?.product_image || getProductImage(product) || undefined;
  const isOutOfStock = product.in_stock === false || (product.stock === 0 && product.in_stock !== true);

  const imageH = productCardSizes.imageHeight;
  const pad    = productCardSizes.cardPadding;
  const cardR  = globalSizes.cardRadius;
  const btnR   = globalSizes.buttonRadius > 0 ? globalSizes.buttonRadius : Radius.full;

  const handleAddToCart = useCallback((e: any) => {
    if (Platform.OS === 'web') {
      const nativeEv = e?.nativeEvent as any;
      if (nativeEv?.stopPropagation) nativeEv.stopPropagation();
      if (nativeEv?.preventDefault) nativeEv.preventDefault();
    } else {
      e?.stopPropagation?.();
    }
    if (isOutOfStock) {
      showCartToast('Out of stock');
      return;
    }
    if (shades.length > 0 && !activeShade) {
      router.push(`/product/${product.id}`);
      return;
    }
    const shadeForCart = activeShade
      ? {
          id: activeShade.id,
          name: activeShade.name,
          color_hex: activeShade.color_hex,
          shade_image: activeShade.shade_image,
          product_image: activeShade.product_image,
        }
      : null;
    addToCart(product, 1, shadeForCart);
    showCartToast('Added to cart');
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1000);
  }, [product, activeShade, shades.length, addToCart, showCartToast, router]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.card, { borderRadius: cardR }]}
      onPress={() => router.push(`/product/${product.id}`)}
    >
      <View style={[styles.imageContainer, { height: imageH, borderTopLeftRadius: cardR, borderTopRightRadius: cardR }]}>
        <Image
          source={displayImage ? { uri: displayImage } : undefined}
          style={[styles.image, isOutOfStock && styles.imageOOS]}
          resizeMode="cover"
          fadeDuration={200}
        />
        {isOutOfStock ? (
          <View style={[styles.badge, styles.oosBadge, isRTL ? styles.badgeRTL : styles.badgeLTR]}>
            <Text style={[styles.badgeText, { fontSize: Math.max(9, productCardSizes.titleFontSize - 3) }]}>
              Out of Stock
            </Text>
          </View>
        ) : product.badge ? (
          <View style={[styles.badge, isRTL ? styles.badgeRTL : styles.badgeLTR]}>
            <Text style={[styles.badgeText, { fontSize: Math.max(9, productCardSizes.titleFontSize - 3) }]}>
              {product.badge}
            </Text>
          </View>
        ) : null}
        <WishlistHeart
          product={product}
          size={13}
          variant="card"
          onLoginRequired={onWishlistLoginRequired}
          wrapStyle={isRTL ? styles.heartWrapRTL : undefined}
        />
      </View>

      {shades.length > 0 && (
        <View style={styles.shadeDotsRow}>
          {shades.slice(0, 6).map((shade) => {
            const isActive = activeShade?.id === shade.id;
            const shadeOOS = shade.is_available === false;
            return (
              <TouchableOpacity
                key={shade.id}
                activeOpacity={shadeOOS ? 1 : 0.7}
                onPress={(e) => {
                  e.stopPropagation();
                  if (shadeOOS) { showCartToast('This shade is out of stock'); return; }
                  setActiveShade(isActive ? null : shade);
                }}
                style={[
                  styles.shadeDotOuter,
                  isActive && styles.shadeDotActive,
                  shadeOOS && styles.shadeDotOOS,
                ]}
              >
                {shade.shade_image ? (
                  <Image
                    source={{ uri: shade.shade_image }}
                    style={styles.shadeDotImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.shadeDotColor,
                      { backgroundColor: shade.color_hex || '#888' },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
          {shades.length > 6 && (
            <Text style={styles.shadeMore}>+{shades.length - 6}</Text>
          )}
        </View>
      )}

      <View style={[styles.info, { padding: pad }]}>
        <Text
          style={[styles.name, {
            fontSize: productCardSizes.titleFontSize,
            textAlign: isRTL ? 'right' : 'left',
          }]}
          numberOfLines={2}
        >
          {getProductName(product, language)}
        </Text>
        <View style={[styles.ratingRow, isRTL && styles.ratingRowRTL]}>
          <StarRating
            rating={product.rating}
            reviewCount={product.review_count}
            size={Math.max(8, productCardSizes.ratingFontSize - 1)}
            showCount={false}
          />
        </View>
        <View style={[styles.priceRow, isRTL && styles.priceRowRTL]}>
          <View style={[styles.priceGroup, isRTL && styles.priceGroupRTL]}>
            <Text style={[styles.price, { fontSize: productCardSizes.priceFontSize }]}>
              {formatPrice(product.price, language)}
            </Text>
            {product.compare_price != null && product.compare_price > product.price && (
              <Text style={[styles.comparePrice, { fontSize: Math.max(9, productCardSizes.priceFontSize - 3) }]}>
                {formatPrice(product.compare_price, language)}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={[styles.addBtn, justAdded && styles.addBtnAdded, isOutOfStock && styles.addBtnOOS, { borderRadius: btnR }]}
            onPress={handleAddToCart}
            activeOpacity={isOutOfStock ? 1 : 0.8}
          >
            {justAdded
              ? <Check size={Math.max(10, productCardSizes.addToCartBtnSize)} color={Colors.white} strokeWidth={2.5} />
              : <ShoppingCart size={Math.max(10, productCardSizes.addToCartBtnSize)} color={Colors.white} strokeWidth={2} />
            }
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.card,
  },
  imageContainer: {
    width: '100%',
    backgroundColor: Colors.backgroundSecondary,
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover' as const,
  },
  imageOOS: { opacity: 0.55 },
  badge: {
    position: 'absolute',
    top: 5,
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
  badgeLTR: { left: 5 },
  badgeRTL: { right: 5 },
  heartWrapRTL: { position: 'absolute', top: 6, left: 6, right: undefined as any, zIndex: 10 },
  badgeText: {
    color: Colors.white,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  info: {
    gap: 2,
  },
  name: {
    color: Colors.textPrimary,
    fontWeight: '600',
    lineHeight: 14,
  },
  ratingRow: { flexDirection: 'row' },
  ratingRowRTL: { flexDirection: 'row-reverse' },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  priceRowRTL: { flexDirection: 'row-reverse' },
  priceGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  priceGroupRTL: { flexDirection: 'row-reverse' },
  price: {
    color: Colors.neonBlue,
    fontWeight: '800',
  },
  comparePrice: {
    color: Colors.textMuted,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  addBtn: {
    backgroundColor: Colors.neonBlueDim,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.neonBlueSubtle,
  },
  addBtnAdded: {
    backgroundColor: '#1a7a45',
  },
  addBtnOOS: {
    backgroundColor: 'rgba(80,40,40,0.6)',
    opacity: 0.65,
  },

  // Shade dots
  shadeDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 4,
    gap: 4,
    flexWrap: 'wrap',
  },
  shadeDotOuter: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  shadeDotActive: {
    borderColor: Colors.neonBlue,
  },
  shadeDotOOS: {
    opacity: 0.35,
    borderColor: 'rgba(255,68,68,0.4)',
  },
  shadeDotImage: {
    width: 12,
    height: 12,
    borderRadius: 6,
    resizeMode: 'cover' as const,
  },
  shadeDotColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  shadeMore: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 1,
  },
});

export default memo(ProductCardComponent);
