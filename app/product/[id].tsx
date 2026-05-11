import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ShoppingCart, Package, Shield, Star, ChevronRight, Sparkles, Share2 } from 'lucide-react-native';
import { shareContent, buildProductSharePayload } from '@/lib/share';
import { hasBonusPoints, getBonusBadgeLabel, getProductBonusPoints } from '@/lib/loyalty';
import {
  fetchProductById,
  fetchProductGallery,
  fetchProductShades,
  getRelatedProducts,
  Product,
  ProductShade,
  getProductName,
  getProductDescription,
  getProductImage,
  getProductImages,
} from '@/lib/supabase';
import { isTryOnEligible } from '@/lib/virtualTryOn';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import StarRating from '@/components/StarRating';
import QuantitySelector from '@/components/QuantitySelector';
import GlossyButton from '@/components/GlossyButton';
import ProductCard from '@/components/ProductCard';
import WishlistHeart from '@/components/WishlistHeart';
import VirtualTryOnModal from '@/components/VirtualTryOnModal';
import ImageViewerModal from '@/components/ImageViewerModal';
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';
import { useAppColors, useThemeMode } from '@/context/ThemeContext';
import { formatPrice } from '@/lib/currency';
import { ProductDetailSkeleton } from '@/components/Skeleton';

export default function ProductDetailScreen() {
  const { width, height } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToCart, items } = useCart();
  const { t, language } = useLanguage();
  const C = useAppColors();
  const themeMode = useThemeMode();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [related, setRelated] = useState<Product[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [shades, setShades] = useState<ProductShade[]>([]);
  const [selectedShade, setSelectedShade] = useState<ProductShade | null>(null);
  const [tryOnVisible, setTryOnVisible] = useState(false);
  const [shadeWarning, setShadeWarning] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setRelated([]);
    setGalleryImages([]);
    setShades([]);
    setSelectedShade(null);
    setActiveImageIndex(0);

    Promise.all([
      fetchProductById(id, language),
      fetchProductGallery(id),
      fetchProductShades(id),
    ])
      .then(([data, gallery, shadesData]) => {
        if (data) {
          setProduct(data);
          setGalleryImages(gallery.length > 0 ? gallery : getProductImages(data));
          setShades(shadesData);
          getRelatedProducts(data, language, 4)
            .then(setRelated)
            .catch(() => {});
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, language]);

  const requiresShade = shades.length > 0;
  const canTryOn = product ? isTryOnEligible(product.category, shades.length > 0) : false;
  const isProductOOS = product ? (product.in_stock === false || product.stock === 0) : false;

  const handleAddToCart = useCallback(() => {
    if (!product) return;
    if (isProductOOS) return;
    if (requiresShade && !selectedShade) {
      setShadeWarning(true);
      setTimeout(() => setShadeWarning(false), 3000);
      return;
    }
    const shadeForCart = selectedShade
      ? {
          id: selectedShade.id,
          name: selectedShade.name,
          color_hex: selectedShade.color_hex,
          shade_image: selectedShade.shade_image,
          product_image: selectedShade.product_image,
        }
      : null;
    addToCart(product, quantity, shadeForCart);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  }, [product, requiresShade, selectedShade, addToCart, quantity]);

  const handleTryOnAddToCart = useCallback(() => {
    if (!product || !selectedShade) return;
    addToCart(product, quantity, {
      id: selectedShade.id,
      name: selectedShade.name,
      color_hex: selectedShade.color_hex,
      shade_image: selectedShade.shade_image,
      product_image: selectedShade.product_image,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  }, [product, selectedShade, addToCart, quantity]);

  const [shareState, setShareState] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleShare = useCallback(async () => {
    if (!product) return;
    const name = getProductName(product, language);
    const price = formatPrice(product.price, language);
    const payload = buildProductSharePayload(name, price, product.id, language);
    const result = await shareContent(payload);
    if (result === 'copied') {
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2500);
    } else if (result === 'error') {
      setShareState('error');
      setTimeout(() => setShareState('idle'), 2500);
    }
    // 'shared' and 'cancelled' — no toast needed
  }, [product, language]);

  const inCartQty = items
    .filter((i) => i.product.id === id)
    .reduce((sum, i) => sum + i.quantity, 0);

  const isMobile = width < 768;
  const imageContainerHeight = isMobile
    ? Math.min(320, Math.max(220, Math.round(height * 0.38)))
    : Math.min(420, Math.max(300, Math.round(height * 0.45)));

  if (loading || !product) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: C.background }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ProductDetailSkeleton />
        </ScrollView>
      </View>
    );
  }

  const images = galleryImages.length > 0 ? galleryImages : getProductImages(product);
  const activeImage = selectedShade?.product_image
    ? selectedShade.product_image
    : (images[activeImageIndex] || getProductImage(product));

  const viewerImages = selectedShade?.product_image
    ? [selectedShade.product_image, ...images.filter((img) => img !== selectedShade.product_image)]
    : images.length > 0 ? images : [getProductImage(product)];
  const viewerInitialIndex = selectedShade?.product_image ? 0 : activeImageIndex;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      {/* Back button — fixed over the entire screen, never clipped by ScrollView */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
        activeOpacity={0.6}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ArrowLeft size={22} color="#FFFFFF" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Top-right: Share + Wishlist cluster */}
      <View style={styles.topRightCluster}>
        <WishlistHeart product={product} size={20} variant="detail" />
        <TouchableOpacity
          style={[styles.shareBtn, shareState === 'copied' && styles.shareBtnCopied]}
          onPress={handleShare}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Share2
            size={18}
            color={shareState === 'copied' ? Colors.success : shareState === 'error' ? Colors.error : '#FFFFFF'}
            strokeWidth={2.2}
          />
        </TouchableOpacity>
      </View>
      {shareState !== 'idle' && (
        <View
          style={[styles.copiedToast, shareState === 'error' && styles.copiedToastError]}
          pointerEvents="none"
        >
          <Text style={styles.copiedToastText}>
            {shareState === 'error'
              ? (language === 'ar' ? 'تعذر المشاركة' : 'Share unavailable')
              : (language === 'ar' ? 'تم نسخ الرابط' : 'Link copied')}
          </Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} bounces>
        {/* Image section — plain View so back button is never swallowed */}
        <View style={[styles.imageContainer, { height: imageContainerHeight, backgroundColor: C.backgroundSecondary }]}>
          {/* Tap-to-open-viewer overlay — sits below all buttons */}
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={0.95}
            onPress={() => setImageViewerVisible(true)}
          >
            <Image
              source={{ uri: activeImage }}
              style={styles.image}
              resizeMode="contain"
            />
            <LinearGradient
              colors={themeMode === 'light'
                ? ['rgba(255,255,255,0.1)', 'transparent', 'rgba(255,255,255,0.3)']
                : ['rgba(5,10,20,0.4)', 'transparent', 'rgba(5,10,20,0.9)']}
              style={StyleSheet.absoluteFillObject}
            />
          </TouchableOpacity>

          {/* Badge and category tag — non-interactive overlays */}
          {product.badge && (
            <View style={styles.badge} pointerEvents="none">
              <Text style={styles.badgeText}>{product.badge}</Text>
            </View>
          )}
          <View style={styles.imageBottom} pointerEvents="none">
            <Text style={styles.categoryTag}>
              {product.category.toUpperCase()}
            </Text>
          </View>
        </View>

        {images.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailRow}
          >
            {images.map((img, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setActiveImageIndex(idx)}
                activeOpacity={0.8}
                style={[
                  styles.thumbnail,
                  { borderColor: C.border },
                  idx === activeImageIndex && styles.thumbnailActive,
                ]}
              >
                <Image
                  source={{ uri: img }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {shades.length > 0 && (
          <View style={styles.shadeSection}>
            <View style={styles.shadeHeader}>
              {selectedShade ? (
                <Text style={[styles.shadeName, { color: C.textSecondary }]}>{selectedShade.name}</Text>
              ) : (
                <Text style={[styles.shadeName, { color: C.textSecondary }, shadeWarning && { color: Colors.error }]}>
                  {t.selectShade ?? 'Select a shade'}
                </Text>
              )}
              {canTryOn && Platform.OS === 'web' && selectedShade && (
                <TouchableOpacity
                  style={styles.tryOnBtn}
                  onPress={() => setTryOnVisible(true)}
                  activeOpacity={0.8}
                >
                  <Sparkles size={13} color={Colors.neonBlue} strokeWidth={2} />
                  <Text style={styles.tryOnBtnText}>{t.tryOn ?? 'Try On'}</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shadeRow}
            >
              {shades.map((shade) => {
                const isActive = selectedShade?.id === shade.id;
                const shadeOOS = shade.is_available === false;
                return (
                  <TouchableOpacity
                    key={shade.id}
                    activeOpacity={shadeOOS ? 1 : 0.7}
                    onPress={() => {
                      if (shadeOOS) return;
                      if (isActive && !requiresShade) {
                        setSelectedShade(null);
                      } else if (!isActive) {
                        setSelectedShade(shade);
                        setShadeWarning(false);
                      }
                    }}
                    style={[
                      styles.shadeCircleOuter,
                      isActive && styles.shadeCircleOuterActive,
                      shadeOOS && styles.shadeCircleOOS,
                    ]}
                  >
                    {shade.shade_image ? (
                      <Image
                        source={{ uri: shade.shade_image }}
                        style={styles.shadeCircleImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.shadeCircleColor,
                          { backgroundColor: shade.color_hex || '#888' },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: C.textPrimary }]}>{getProductName(product, language)}</Text>
          </View>
          <View style={styles.ratingRow}>
            <StarRating
              rating={product.rating}
              reviewCount={product.review_count}
              size={16}
            />
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(product.price, language)}</Text>
            {product.compare_price != null && product.compare_price > product.price && (
              <Text style={styles.comparePrice}>{formatPrice(product.compare_price, language)}</Text>
            )}
          </View>

          {hasBonusPoints(product) && (
            <View style={styles.bonusRow}>
              <View style={styles.bonusPill}>
                <Text style={styles.bonusPillText}>
                  {getBonusBadgeLabel(product, t as unknown as Record<string, string>)}
                </Text>
              </View>
              <Text style={[styles.bonusEarnText, { color: C.textMuted }]}>
                {((t as any).loyaltyPointsEarnedOnOrder ?? 'You will earn {{n}} bonus points').replace(
                  '{{n}}',
                  getProductBonusPoints(product).toLocaleString()
                )}
              </Text>
            </View>
          )}

          {product.sku && (
            <Text style={[styles.sku, { color: C.textMuted }]}>{t.skuLabel}: {product.sku}</Text>
          )}

          <View style={styles.trustRow}>
            <TrustBadge icon={<Shield size={14} color={Colors.neonBlue} />} label={t.proTested} />
            <TrustBadge icon={<Package size={14} color={Colors.neonBlue} />} label={t.freeShipping} />
            <TrustBadge icon={<Star size={14} color={Colors.neonBlue} />} label={t.topRated} />
          </View>

          <View style={[styles.divider, { backgroundColor: C.borderLight }]} />

          <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>{t.description}</Text>
          <Text style={[styles.description, { color: C.textSecondary }]}>{getProductDescription(product, language)}</Text>

          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: C.borderLight }]} />
              <Text style={[styles.sectionTitle, { color: C.textPrimary }]}>{t.specifications}</Text>
              <View style={[styles.specsTable, { borderColor: C.border }]}>
                {Object.entries(product.specifications).map(([key, val]) => (
                  <View key={key} style={[styles.specRow, { borderBottomColor: C.border }]}>
                    <Text style={[styles.specKey, { color: C.textSecondary }]}>{key}</Text>
                    <Text style={[styles.specVal, { color: C.textPrimary }]}>{String(val)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={[styles.divider, { backgroundColor: C.borderLight }]} />

          <View style={styles.stockRow}>
            <View
              style={[
                styles.stockDot,
                {
                  backgroundColor: isProductOOS
                    ? Colors.error
                    : product.stock > 10 ? Colors.success : Colors.warning,
                },
              ]}
            />
            <Text style={[styles.stockText, { color: C.textSecondary }, isProductOOS && { color: Colors.error }]}>
              {isProductOOS
                ? t.outOfStock
                : product.stock > 10
                ? t.inStock
                : t.onlyLeft.replace('{{n}}', String(product.stock))}
            </Text>
          </View>

          {shadeWarning && (
            <View style={styles.shadeWarningBanner}>
              <Text style={styles.shadeWarningText}>{t.pleaseSelectShade ?? 'Please select a shade before adding to cart'}</Text>
            </View>
          )}

          {inCartQty > 0 && (
            <View style={styles.inCartBanner}>
              <ShoppingCart size={14} color={Colors.neonBlue} strokeWidth={2} />
              <Text style={styles.inCartText}>{inCartQty} {t.inCart}</Text>
            </View>
          )}

          <View style={styles.qtyRow}>
            <Text style={[styles.qtyLabel, { color: C.textPrimary }]}>{t.quantity}</Text>
            <QuantitySelector
              value={quantity}
              onDecrement={() => { if (!isProductOOS) setQuantity((q) => Math.max(1, q - 1)); }}
              onIncrement={() => { if (!isProductOOS) setQuantity((q) => Math.min(product.stock > 0 ? product.stock : 1, q + 1)); }}
              min={1}
              max={isProductOOS ? 1 : (product.stock > 0 ? product.stock : 1)}
            />
          </View>

          <View style={{ height: Spacing.xl }} />
        </View>

        {/* ── Related Products ──────────────────────────────────────── */}
        {related.length > 0 && (
          <View style={[styles.relatedSection, { borderTopColor: C.borderLight }]}>
            <View style={styles.relatedHeader}>
              <View style={styles.relatedTitleGroup}>
                <View style={styles.relatedAccent} />
                <Text style={[styles.relatedTitle, { color: C.textPrimary }]}>{t.youMayAlsoLike}</Text>
              </View>
              <TouchableOpacity
                style={styles.relatedSeeAll}
                onPress={() => router.push('/(tabs)/products' as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.relatedSeeAllText}>{t.seeAll}</Text>
                <ChevronRight size={14} color={Colors.neonBlue} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.relatedScroll}
            >
              {related.map((item) => (
                <View key={item.id} style={styles.relatedCard}>
                  <ProductCard product={item} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: C.background, borderTopColor: C.border }]}>
        {addedFeedback ? (
          <View style={styles.successBanner}>
            <ShoppingCart size={18} color={Colors.success} strokeWidth={2} />
            <Text style={styles.successText}>{t.addedToCart}</Text>
          </View>
        ) : (
          <View style={styles.footerRow}>
            <View style={styles.footerPrice}>
              <Text style={[styles.footerPriceLabel, { color: C.textMuted }]}>{t.total}</Text>
              <Text style={styles.footerPriceValue}>
                {formatPrice(product.price * quantity, language)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <GlossyButton
                title={isProductOOS ? (t.outOfStock ?? 'Out of Stock') : t.addToCart}
                onPress={handleAddToCart}
                disabled={isProductOOS}
                fullWidth
              />
            </View>
          </View>
        )}
      </View>

      {canTryOn && selectedShade && (
        <VirtualTryOnModal
          visible={tryOnVisible}
          onClose={() => setTryOnVisible(false)}
          productName={getProductName(product, language)}
          productCategory={product.category}
          tryOnType={product.try_on_type}
          shades={shades}
          selectedShade={selectedShade}
          onShadeChange={setSelectedShade}
          onAddToCart={handleTryOnAddToCart}
        />
      )}

      <ImageViewerModal
        visible={imageViewerVisible}
        images={viewerImages}
        initialIndex={viewerInitialIndex}
        onClose={() => setImageViewerVisible(false)}
        onIndexChange={(idx) => {
          if (!selectedShade?.product_image) setActiveImageIndex(idx);
        }}
      />
    </View>
  );
}

function TrustBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.trustBadge}>
      {icon}
      <Text style={styles.trustLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingImage: {
    width: '100%',
    backgroundColor: Colors.backgroundCard,
  },
  loadingContent: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  loadingLine: {
    height: 16,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.sm,
    width: '80%',
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: Colors.backgroundSecondary,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain' as const,
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 32,
    left: Spacing.md,
    width: 48,
    height: 48,
    backgroundColor: 'rgba(5,10,20,0.82)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,224,255,0.45)',
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#00E0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  topRightCluster: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 32,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 9999,
    elevation: 20,
    // Ensure the cluster itself doesn't swallow pointer events on web
    pointerEvents: 'box-none' as any,
  },
  shareBtn: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(5,10,20,0.82)',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    // Explicit pointer events so the button is always clickable on web
    pointerEvents: 'auto' as any,
  },
  shareBtnCopied: {
    borderColor: Colors.success,
    backgroundColor: 'rgba(0,200,83,0.18)',
  },
  copiedToast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 112 : 88,
    right: Spacing.md,
    backgroundColor: Colors.success,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    zIndex: 9999,
    elevation: 20,
  },
  copiedToastError: {
    backgroundColor: Colors.error,
  },
  copiedToastText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 84,
    left: Spacing.md,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
  },
  imageBottom: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
  },
  categoryTag: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 2,
  },
  thumbnailRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  thumbnailActive: {
    borderColor: Colors.neonBlue,
    borderWidth: 2,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover' as const,
  },
  content: {
    padding: Spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  name: {
    color: Colors.textPrimary,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    lineHeight: 34,
  },
  ratingRow: {
    marginBottom: Spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginBottom: Spacing.xs ?? 4,
  },
  price: {
    color: Colors.neonBlue,
    fontSize: FontSize.xxl + 4,
    fontWeight: '900',
    letterSpacing: -0.5,
    ...Shadow.neonBlueSubtle,
  },
  comparePrice: {
    color: Colors.textMuted,
    fontSize: FontSize.lg,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
  },
  bonusPill: {
    backgroundColor: Colors.gold + '20',
    borderWidth: 1,
    borderColor: Colors.gold + '60',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  bonusPillText: {
    color: Colors.gold,
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bonusEarnText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  sku: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginBottom: Spacing.md,
  },
  trustRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  trustLabel: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 24,
  },
  specsTable: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  specRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  specKey: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  specVal: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '500',
    textAlign: 'right',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stockText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  inCartBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  inCartText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  footer: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 36 : Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  footerPrice: {
    gap: 2,
  },
  footerPriceLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  footerPriceValue: {
    color: Colors.neonBlue,
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  successText: {
    color: Colors.success,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },

  // Related products
  relatedSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  relatedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  relatedTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  relatedAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: Colors.neonBlue,
  },
  relatedTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  relatedSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  relatedSeeAllText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  relatedScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  relatedCard: {
    width: 120,
  },

  shadeWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.25)',
  },
  shadeWarningText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },

  // Shade selector
  shadeSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 4,
  },
  shadeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  shadeName: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tryOnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,77,141,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.3)',
  },
  tryOnBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  shadeRow: {
    gap: 10,
    alignItems: 'center',
  },
  shadeCircleOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  shadeCircleOuterActive: {
    borderColor: Colors.neonBlue,
    ...Shadow.neonBlueSubtle,
  },
  shadeCircleOOS: {
    opacity: 0.3,
    borderColor: 'rgba(255,68,68,0.35)',
  },
  shadeCircleImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  shadeCircleColor: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
});
