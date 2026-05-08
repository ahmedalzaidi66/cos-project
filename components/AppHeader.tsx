import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Menu, User, ShoppingCart, ArrowLeft, Heart } from 'lucide-react-native';
import { useCart } from '@/context/CartContext';
import { useLanguage } from '@/context/LanguageContext';
import { useCMS } from '@/context/CMSContext';
import { useWishlist } from '@/context/WishlistContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import NavigationDrawer from '@/components/NavigationDrawer';
import { Colors, Spacing, FontSize } from '@/constants/theme';
import { useUISize } from '@/context/UISizeContext';

type Props = {
  showBack?: boolean;
  title?: string;
};

export default function AppHeader({ showBack = false, title }: Props) {
  const router = useRouter();
  const { totalItems } = useCart();
  const { isRTL } = useLanguage();
  const { branding } = useCMS();
  const { count: wishlistCount } = useWishlist();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { headerSizes } = useUISize();

  const showIcons = branding.header_icons !== 'false';

  // Animate the header heart when wishlistCount increases
  const heartScale = useRef(new Animated.Value(1)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  const prevCountRef = useRef(wishlistCount);

  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = wishlistCount;

    if (wishlistCount > prev) {
      // Item added — heart pops and badge bounces in
      Animated.sequence([
        Animated.spring(heartScale, {
          toValue: 1.4,
          useNativeDriver: true,
          speed: 50,
          bounciness: 0,
        }),
        Animated.spring(heartScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 16,
          bounciness: 20,
        }),
      ]).start();

      badgeScale.setValue(0);
      Animated.spring(badgeScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 22,
        bounciness: 20,
      }).start();
    } else if (wishlistCount < prev && wishlistCount === 0) {
      // All removed — gentle shrink
      Animated.sequence([
        Animated.spring(heartScale, {
          toValue: 0.8,
          useNativeDriver: true,
          speed: 40,
          bounciness: 0,
        }),
        Animated.spring(heartScale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 18,
          bounciness: 8,
        }),
      ]).start();
    }
  }, [wishlistCount]);

  return (
    <>
      <View style={styles.outerWrapper}>
      <View style={[styles.container, isRTL && styles.containerRTL, {
        minHeight: headerSizes.headerHeight,
      }]}>
        {/* Left: hamburger or back */}
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.6}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <ArrowLeft
              size={14}
              color="#FFFFFF"
              strokeWidth={2.5}
              style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => setDrawerOpen(true)}
          >
            <Menu size={16} color={Colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        )}

        {/* Center: logo */}
        <TouchableOpacity
          style={styles.logoContainer}
          onPress={() => router.push('/')}
          activeOpacity={title ? 1 : 0.75}
          disabled={!!title}
        >
          {title ? (
            <Text style={styles.pageTitle}>{title}</Text>
          ) : branding.logo_url ? (
            <Image
              source={{ uri: branding.logo_url }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.logoText}>{branding.app_name || 'Lazurde Makeup'}</Text>
          )}
        </TouchableOpacity>

        {/* Right: account + wishlist + cart */}
        <View style={[styles.rightIcons, isRTL && styles.rightIconsRTL]}>
          <LanguageSwitcher />
          {showIcons && (
            <>
              <TouchableOpacity
                style={styles.iconBtn}
                activeOpacity={0.7}
                onPress={() => router.push('/(tabs)/account')}
              >
                <User size={16} color={Colors.textPrimary} strokeWidth={2} />
              </TouchableOpacity>

              {/* Wishlist heart with animated badge */}
              <TouchableOpacity
                style={styles.iconBtn}
                activeOpacity={0.7}
                onPress={() => router.push('/(tabs)/wishlist')}
              >
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Heart
                    size={14}
                    color={wishlistCount > 0 ? '#FF4D6D' : Colors.textPrimary}
                    fill={wishlistCount > 0 ? '#FF4D6D' : 'transparent'}
                    strokeWidth={2}
                  />
                </Animated.View>
                {wishlistCount > 0 && (
                  <Animated.View
                    style={[
                      styles.badge,
                      styles.wishlistBadge,
                      isRTL ? styles.badgeRTL : styles.badgeLTR,
                      { transform: [{ scale: badgeScale }] },
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {wishlistCount > 99 ? '99+' : wishlistCount}
                    </Text>
                  </Animated.View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconBtn}
                activeOpacity={0.7}
                onPress={() => router.push('/(tabs)/cart')}
              >
                <ShoppingCart size={16} color={Colors.textPrimary} strokeWidth={2} />
                {totalItems > 0 && (
                  <View style={[styles.badge, isRTL ? styles.badgeRTL : styles.badgeLTR]}>
                    <Text style={styles.badgeText}>
                      {totalItems > 99 ? '99+' : totalItems}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
      <View style={styles.bottomDivider} />
      </View>
      <NavigationDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    width: '100%' as any,
    paddingTop: 4,
    paddingHorizontal: 3,
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'ios' ? 30 : 8,
    paddingBottom: 6,
    backgroundColor: '#0A0507',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 141, 0.15)',
    borderBottomWidth: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  bottomDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 77, 141, 0.15)',
  },
  containerRTL: {
    flexDirection: 'row-reverse',
  },
  iconBtn: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  backBtn: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: 'rgba(5,10,20,0.82)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,224,255,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoImage: {
    height: 24,
    width: 68,
  },
  logoText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  pageTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginRight: -2,
  },
  rightIconsRTL: {
    flexDirection: 'row-reverse',
  },
  badge: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#FF4444',
    borderRadius: 999,
    minWidth: 11,
    height: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  wishlistBadge: {
    backgroundColor: '#FF4D6D',
  },
  badgeLTR: {
    right: 1,
  },
  badgeRTL: {
    left: 1,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 7,
    fontWeight: '800',
  },
});
