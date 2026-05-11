import React, { useEffect, useRef, memo } from 'react';
import { View, StyleSheet, Animated, useWindowDimensions, AccessibilityInfo } from 'react-native';
import { useAppColors } from '@/context/ThemeContext';

// ── Core animated shimmer box ────────────────────────────────────────────────

type SkeletonBoxProps = {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
};

export const SkeletonBox = memo(function SkeletonBox({
  width = '100%',
  height,
  borderRadius = 6,
  style,
}: SkeletonBoxProps) {
  const C = useAppColors();
  const shimmer = useRef(new Animated.Value(0)).current;
  const reducedMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((val) => {
      reducedMotion.current = val;
    });
  }, []);

  useEffect(() => {
    if (reducedMotion.current) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.45],
  });

  const baseColor = C.background === '#FFFFFF'
    ? 'rgba(0,0,0,0.08)'   // light theme
    : 'rgba(255,255,255,0.07)'; // dark theme

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: baseColor, opacity },
        style,
      ]}
      accessibilityLabel="Loading"
      accessible
    />
  );
});

// ── Skeleton Row (horizontal group) ─────────────────────────────────────────

type SkeletonRowProps = {
  gap?: number;
  children: React.ReactNode;
  style?: object;
};

export const SkeletonRow = memo(function SkeletonRow({ gap = 8, children, style }: SkeletonRowProps) {
  return (
    <View style={[{ flexDirection: 'row', gap, alignItems: 'center' }, style]}>
      {children}
    </View>
  );
});

// ── Product Card Skeleton ────────────────────────────────────────────────────

type ProductCardSkeletonProps = {
  imageHeight?: number;
};

export const ProductCardSkeleton = memo(function ProductCardSkeleton({
  imageHeight = 140,
}: ProductCardSkeletonProps) {
  const C = useAppColors();
  return (
    <View style={[styles.card, { backgroundColor: C.backgroundCard, borderColor: C.border }]}>
      <SkeletonBox height={imageHeight} borderRadius={0} />
      <View style={styles.cardBody}>
        <SkeletonBox height={11} width="80%" />
        <SkeletonBox height={9} width="55%" style={{ marginTop: 5 }} />
        <SkeletonRow style={{ marginTop: 6 }} gap={6}>
          <SkeletonBox height={12} width="40%" />
          <SkeletonBox height={24} width={28} borderRadius={6} />
        </SkeletonRow>
      </View>
    </View>
  );
});

// ── Product Grid Skeleton ────────────────────────────────────────────────────

type ProductGridSkeletonProps = {
  count?: number;
  numCols?: number;
  imageHeight?: number;
};

export function ProductGridSkeleton({
  count = 6,
  numCols = 2,
  imageHeight = 140,
}: ProductGridSkeletonProps) {
  const { width } = useWindowDimensions();
  const gap = 8;
  const padding = 12;
  const cardW = (width - padding * 2 - gap * (numCols - 1)) / numCols;

  return (
    <View style={[styles.grid, { paddingHorizontal: padding, gap }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: cardW }}>
          <ProductCardSkeleton imageHeight={imageHeight} />
        </View>
      ))}
    </View>
  );
}

// ── Hero Slider Skeleton ─────────────────────────────────────────────────────

type HeroSkeletonProps = {
  height?: number;
};

export const HeroSkeleton = memo(function HeroSkeleton({ height = 220 }: HeroSkeletonProps) {
  return (
    <View style={{ height, position: 'relative', overflow: 'hidden' }}>
      <SkeletonBox height={height} borderRadius={0} width="100%" />
      {/* Simulated text overlay at bottom */}
      <View style={styles.heroTextOverlay}>
        <SkeletonBox height={10} width={80} borderRadius={4} style={{ marginBottom: 8 }} />
        <SkeletonBox height={20} width="60%" borderRadius={4} style={{ marginBottom: 6 }} />
        <SkeletonBox height={13} width="45%" borderRadius={4} style={{ marginBottom: 14 }} />
        <SkeletonBox height={28} width={100} borderRadius={14} />
      </View>
    </View>
  );
});

// ── Category Chips Row Skeleton ──────────────────────────────────────────────

export const CategoryRowSkeleton = memo(function CategoryRowSkeleton() {
  const chips = [80, 72, 90, 68, 84, 76];
  return (
    <View style={styles.categoryRow}>
      {chips.map((w, i) => (
        <SkeletonBox key={i} height={32} width={w} borderRadius={20} />
      ))}
    </View>
  );
});

// ── Horizontal Product Row Skeleton ─────────────────────────────────────────

export const HorizontalRowSkeleton = memo(function HorizontalRowSkeleton() {
  return (
    <View style={styles.sectionWrap}>
      {/* Section title */}
      <SkeletonBox height={14} width={140} style={{ marginBottom: 10, marginHorizontal: 12 }} />
      {/* Horizontal cards */}
      <View style={styles.hRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.hCard}>
            <SkeletonBox height={110} width={120} borderRadius={10} />
            <SkeletonBox height={10} width={100} borderRadius={4} style={{ marginTop: 6 }} />
            <SkeletonBox height={9} width={70} borderRadius={4} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>
    </View>
  );
});

// ── Home Page Skeleton ───────────────────────────────────────────────────────

export function HomePageSkeleton() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const heroH = isMobile
    ? Math.min(260, Math.max(180, Math.round(width * 0.52)))
    : Math.min(340, Math.max(260, Math.round(width * 0.28)));

  return (
    <View style={styles.homeWrap}>
      <HeroSkeleton height={heroH} />
      <View style={{ paddingVertical: 14 }}>
        <SkeletonBox height={13} width={120} style={{ marginHorizontal: 14, marginBottom: 10 }} />
        <CategoryRowSkeleton />
      </View>
      <HorizontalRowSkeleton />
      <HorizontalRowSkeleton />
    </View>
  );
}

// ── Product Detail Skeleton ──────────────────────────────────────────────────

export const ProductDetailSkeleton = memo(function ProductDetailSkeleton() {
  const { width } = useWindowDimensions();
  const imgH = Math.min(380, Math.round(width * 0.72));
  return (
    <View style={styles.detailWrap}>
      {/* Image */}
      <SkeletonBox height={imgH} width="100%" borderRadius={0} />
      {/* Thumbnail strip */}
      <View style={styles.thumbRow}>
        {[0, 1, 2].map((i) => (
          <SkeletonBox key={i} height={54} width={54} borderRadius={8} />
        ))}
      </View>
      {/* Content */}
      <View style={styles.detailContent}>
        <SkeletonBox height={10} width={80} borderRadius={4} />
        <SkeletonBox height={22} width="85%" borderRadius={4} style={{ marginTop: 8 }} />
        <SkeletonBox height={14} width={120} borderRadius={4} style={{ marginTop: 8 }} />
        <SkeletonBox height={1} width="100%" borderRadius={1} style={{ marginVertical: 16 }} />
        {/* Shade dots */}
        <SkeletonRow gap={8} style={{ marginBottom: 14 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonBox key={i} height={28} width={28} borderRadius={14} />
          ))}
        </SkeletonRow>
        {/* Description lines */}
        {[100, 90, 75, 55].map((w, i) => (
          <SkeletonBox key={i} height={10} width={`${w}%`} borderRadius={4} style={{ marginBottom: 6 }} />
        ))}
        <SkeletonBox height={48} width="100%" borderRadius={24} style={{ marginTop: 20 }} />
      </View>
    </View>
  );
});

// ── List Item Skeleton (orders, notifications, wishlist cards) ───────────────

export const ListItemSkeleton = memo(function ListItemSkeleton({
  imageSize = 64,
  lines = 3,
}: {
  imageSize?: number;
  lines?: number;
}) {
  return (
    <SkeletonRow style={styles.listItem} gap={12}>
      <SkeletonBox height={imageSize} width={imageSize} borderRadius={8} />
      <View style={{ flex: 1, gap: 6 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBox
            key={i}
            height={i === 0 ? 12 : 10}
            width={i === 0 ? '80%' : i === 1 ? '60%' : '40%'}
            borderRadius={4}
          />
        ))}
      </View>
    </SkeletonRow>
  );
});

// ── Wishlist Skeleton ────────────────────────────────────────────────────────

export function WishlistSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.listWrap}>
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} imageSize={80} lines={3} />
      ))}
    </View>
  );
}

// ── Notifications Skeleton ───────────────────────────────────────────────────

export function NotificationsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.listWrap}>
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} imageSize={44} lines={2} />
      ))}
    </View>
  );
}

// ── Cart Skeleton ────────────────────────────────────────────────────────────

export function CartSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.listWrap}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.cartItem}>
          <SkeletonBox height={90} width={80} borderRadius={8} />
          <View style={{ flex: 1, gap: 7 }}>
            <SkeletonBox height={12} width="75%" borderRadius={4} />
            <SkeletonBox height={10} width="50%" borderRadius={4} />
            <SkeletonRow gap={8}>
              <SkeletonBox height={28} width={80} borderRadius={14} />
              <SkeletonBox height={14} width={60} borderRadius={4} />
            </SkeletonRow>
          </View>
        </View>
      ))}
      {/* Order summary */}
      <View style={styles.orderSummary}>
        {[0, 1, 2].map((i) => (
          <SkeletonRow key={i} style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <SkeletonBox height={11} width={80} borderRadius={4} />
            <SkeletonBox height={11} width={60} borderRadius={4} />
          </SkeletonRow>
        ))}
        <SkeletonBox height={46} width="100%" borderRadius={23} style={{ marginTop: 10 }} />
      </View>
    </View>
  );
}

// ── Account Profile Skeleton ─────────────────────────────────────────────────

export const AccountProfileSkeleton = memo(function AccountProfileSkeleton() {
  return (
    <View style={styles.accountWrap}>
      {/* Avatar + name */}
      <View style={styles.avatarRow}>
        <SkeletonBox height={72} width={72} borderRadius={36} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBox height={14} width="60%" borderRadius={4} />
          <SkeletonBox height={11} width="45%" borderRadius={4} />
        </View>
      </View>
      {/* Menu rows */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.menuRowSkel}>
          <SkeletonBox height={36} width={36} borderRadius={8} />
          <SkeletonBox height={12} width="55%" borderRadius={4} />
        </View>
      ))}
    </View>
  );
});

// ── Checkout Skeleton ────────────────────────────────────────────────────────

export const CheckoutSkeleton = memo(function CheckoutSkeleton() {
  return (
    <View style={styles.checkoutWrap}>
      <SkeletonBox height={16} width={160} borderRadius={4} style={{ marginBottom: 18 }} />
      {/* Form fields */}
      {[0, 1, 2, 3].map((i) => (
        <SkeletonBox key={i} height={48} width="100%" borderRadius={10} style={{ marginBottom: 10 }} />
      ))}
      <SkeletonBox height={1} width="100%" borderRadius={1} style={{ marginVertical: 16 }} />
      <SkeletonBox height={14} width={120} borderRadius={4} style={{ marginBottom: 12 }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.payRow}>
          <SkeletonBox height={20} width={20} borderRadius={10} />
          <SkeletonBox height={12} width="50%" borderRadius={4} />
        </View>
      ))}
      <SkeletonBox height={52} width="100%" borderRadius={26} style={{ marginTop: 20 }} />
    </View>
  );
});

// ── Canopy Skeleton ──────────────────────────────────────────────────────────

export const CanopySkeleton = memo(function CanopySkeleton() {
  const { width } = useWindowDimensions();
  const canvasSize = Math.min(width - 24, 500);
  return (
    <View style={styles.canopyWrap}>
      {/* Before/after cards */}
      <SkeletonRow gap={8} style={{ marginBottom: 16, paddingHorizontal: 12 }}>
        <SkeletonBox height={180} width={(canvasSize - 8) / 2} borderRadius={10} />
        <SkeletonBox height={180} width={(canvasSize - 8) / 2} borderRadius={10} />
      </SkeletonRow>
      {/* Category chips */}
      <CategoryRowSkeleton />
      {/* Product mini-cards */}
      <View style={styles.canopyProducts}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.canopyCard}>
            <SkeletonBox height={100} width={120} borderRadius={8} />
            <SkeletonBox height={9} width={100} borderRadius={4} style={{ marginTop: 5 }} />
            <SkeletonBox height={8} width={70} borderRadius={4} style={{ marginTop: 3 }} />
          </View>
        ))}
      </View>
    </View>
  );
});

// ── Search Results Skeleton ──────────────────────────────────────────────────

export const SearchResultsSkeleton = memo(function SearchResultsSkeleton() {
  const { width } = useWindowDimensions();
  const numCols = width >= 600 ? 3 : 2;
  const gap = 6;
  const padding = 8;
  const cardW = (width - padding * 2 - gap * (numCols - 1)) / numCols;

  return (
    <View style={[styles.grid, { paddingHorizontal: padding, gap }]}>
      {Array.from({ length: numCols * 2 }).map((_, i) => (
        <View key={i} style={{ width: cardW }}>
          <ProductCardSkeleton imageHeight={120} />
        </View>
      ))}
    </View>
  );
});

// ── Wallet / Loyalty Skeleton ────────────────────────────────────────────────

export const WalletSkeleton = memo(function WalletSkeleton() {
  return (
    <View style={{ gap: 12, paddingVertical: 4 }}>
      {/* Stats row */}
      <SkeletonRow gap={8}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, gap: 6, padding: 12, borderRadius: 10, backgroundColor: 'transparent' }}>
            <SkeletonBox height={22} width="70%" borderRadius={4} />
            <SkeletonBox height={10} width="55%" borderRadius={4} />
          </View>
        ))}
      </SkeletonRow>
      {/* Progress bar */}
      <View style={{ gap: 8, paddingHorizontal: 2 }}>
        <SkeletonRow style={{ justifyContent: 'space-between' }}>
          <SkeletonBox height={11} width={120} borderRadius={4} />
          <SkeletonBox height={11} width={36} borderRadius={4} />
        </SkeletonRow>
        <SkeletonBox height={8} width="100%" borderRadius={4} />
        <SkeletonBox height={10} width={180} borderRadius={4} />
      </View>
      {/* Transaction rows */}
      <View style={{ gap: 0 }}>
        <SkeletonBox height={12} width={120} borderRadius={4} style={{ marginBottom: 10 }} />
        {[0, 1, 2, 3].map((i) => (
          <SkeletonRow key={i} style={{ justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(255,255,255,0.05)' }}>
            <View style={{ gap: 5 }}>
              <SkeletonBox height={12} width={90} borderRadius={4} />
              <SkeletonBox height={9} width={140} borderRadius={4} />
              <SkeletonBox height={9} width={70} borderRadius={4} />
            </View>
            <View style={{ gap: 5, alignItems: 'flex-end' }}>
              <SkeletonBox height={12} width={56} borderRadius={4} />
              <SkeletonBox height={9} width={72} borderRadius={4} />
            </View>
          </SkeletonRow>
        ))}
      </View>
    </View>
  );
});

// ── Chat Message Skeleton ────────────────────────────────────────────────────

export const ChatMessageSkeleton = memo(function ChatMessageSkeleton() {
  return (
    <View style={styles.chatBubble}>
      <SkeletonBox height={10} width="80%" borderRadius={4} style={{ marginBottom: 5 }} />
      <SkeletonBox height={10} width="60%" borderRadius={4} style={{ marginBottom: 5 }} />
      <SkeletonBox height={10} width="40%" borderRadius={4} />
    </View>
  );
});

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardBody: {
    padding: 8,
    gap: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  heroTextOverlay: {
    position: 'absolute',
    bottom: 28,
    left: 18,
    right: 18,
    alignItems: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  sectionWrap: {
    paddingVertical: 10,
  },
  hRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
  },
  hCard: {
    gap: 0,
  },
  homeWrap: {
    flex: 1,
  },
  detailWrap: {
    flex: 1,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailContent: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  listItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  listWrap: {
    flex: 1,
    paddingTop: 8,
  },
  cartItem: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  orderSummary: {
    marginHorizontal: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
  },
  accountWrap: {
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 0,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  menuRowSkel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  checkoutWrap: {
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  canopyWrap: {
    paddingTop: 12,
  },
  canopyProducts: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    flexWrap: 'wrap',
  },
  canopyCard: {
    gap: 0,
  },
  chatBubble: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: '78%',
  },
});
