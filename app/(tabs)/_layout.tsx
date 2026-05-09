import React, { useRef, useCallback } from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { House, ShoppingBag, Camera, User, Heart, Bell } from 'lucide-react-native';
import { useWishlist } from '@/context/WishlistContext';
import { useNotifications } from '@/context/NotificationContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '@/context/ThemeContext';

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabDef = {
  name: string;
  route: string;
  label: string;
  icon?: (active: boolean) => React.ReactNode;
  isCenter?: boolean;
};

function getTabs(t: { navHome: string; navShop: string; navSaved: string; navAccount: string; navMatch: string; navAlerts: string }): TabDef[] {
  return [
    {
      name: 'index',
      route: '/(tabs)/',
      label: t.navHome,
      icon: (active) => (
        <House size={18} color={active ? '#FF4D8D' : '#804060'} strokeWidth={active ? 2.5 : 1.8} />
      ),
    },
    {
      name: 'cart',
      route: '/(tabs)/cart',
      label: t.navShop,
      icon: (active) => (
        <ShoppingBag size={18} color={active ? '#FF4D8D' : '#804060'} strokeWidth={active ? 2.5 : 1.8} />
      ),
    },
    {
      name: 'canopy',
      route: '/(tabs)/canopy',
      label: t.navMatch,
      isCenter: true,
    },
    {
      name: 'notifications',
      route: '/(tabs)/notifications',
      label: t.navAlerts,
      icon: (active) => (
        <Bell size={18} color={active ? '#FF4D8D' : '#804060'} strokeWidth={active ? 2.5 : 1.8} />
      ),
    },
    {
      name: 'account',
      route: '/(tabs)/account',
      label: t.navAccount,
      icon: (active) => (
        <User size={18} color={active ? '#FF4D8D' : '#804060'} strokeWidth={active ? 2.5 : 1.8} />
      ),
    },
  ];
}

// ─── Animated tab item ────────────────────────────────────────────────────────

function TabItem({
  tab,
  active,
  onPress,
  badge,
}: {
  tab: TabDef;
  active: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.82,
        useNativeDriver: true,
        speed: 50,
        bounciness: 0,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 14,
      }),
    ]).start();
    onPress();
  }, [onPress, scale]);

  return (
    <Pressable
      style={styles.tabItem}
      onPress={handlePress}
      android_ripple={null}
    >
      <Animated.View style={[styles.tabContent, { transform: [{ scale }] }]}>
        <View style={{ position: 'relative' }}>
          {tab.icon && tab.icon(active)}
          {badge != null && badge > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {badge > 99 ? '99+' : String(badge)}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.tabLabel, active && styles.tabLabelActive]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
        <View style={[styles.activeDot, active && styles.activeDotVisible]} />
      </Animated.View>
    </Pressable>
  );
}

// ─── Center Match Filter button ──────────────────────────────────────────────

function CenterTabItem({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(active ? 1 : 0.4)).current;

  React.useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: active ? 1 : 0.4,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [active, glowAnim]);

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 0.88,
        useNativeDriver: true,
        speed: 60,
        bounciness: 0,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 18,
      }),
    ]).start();
    onPress();
  }, [onPress, scale]);

  return (
    <Pressable
      style={styles.centerTabItem}
      onPress={handlePress}
      android_ripple={null}
    >
      <Animated.View
        style={[
          styles.centerGlowRing,
          { opacity: glowAnim },
        ]}
      />
      <Animated.View
        style={[
          styles.centerButton,
          active && styles.centerButtonActive,
          { transform: [{ scale }] },
        ]}
      >
        <Camera
          size={20}
          color={active ? '#FFFFFF' : '#D6A0B8'}
          strokeWidth={2}
        />
      </Animated.View>
      <Text style={[styles.centerLabel, active && styles.centerLabelActive]}>
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

// ─── Custom tab bar ───────────────────────────────────────────────────────────

function CustomTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { count: wishlistCount } = useWishlist();
  const { unreadCount: notifUnreadCount } = useNotifications();
  const { t } = useLanguage();
  const C = useAppColors();
  const TABS = getTabs(t);

  const isActive = useCallback(
    (tab: TabDef) => {
      if (tab.name === 'index') return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/';
      return pathname.startsWith(`/(tabs)/${tab.name}`);
    },
    [pathname],
  );

  const navigate = useCallback(
    (tab: TabDef) => {
      router.push(tab.route as any);
    },
    [router],
  );

  const barPaddingBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 6);

  return (
    <View style={[styles.barWrapper, { paddingBottom: barPaddingBottom }]}>
      <View style={[styles.barBg, { backgroundColor: C.tabBar }]} />
      <View style={styles.barTopBorder} />

      <View style={styles.barInner}>
        {TABS.map((tab) => {
          const active = isActive(tab);
          if (tab.isCenter) {
            return (
              <CenterTabItem
                key={tab.name}
                active={active}
                onPress={() => navigate(tab)}
                label={tab.label}
              />
            );
          }
          return (
            <TabItem
              key={tab.name}
              tab={tab}
              active={active}
              onPress={() => navigate(tab)}
              badge={tab.name === 'wishlist' ? wishlistCount : tab.name === 'notifications' ? notifUnreadCount : undefined}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Root layout ─────────────────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      tabBar={() => <CustomTabBar />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="about" options={{ href: null }} />
      <Tabs.Screen name="canopy" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="wishlist" options={{ href: null }} />
      <Tabs.Screen name="account" />
      <Tabs.Screen name="products" options={{ href: null }} />
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  barWrapper: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  barBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0507',
  },
  barTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,77,141,0.55)',
    shadowColor: '#FF4D8D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 0,
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 6,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 3,
    minHeight: 44,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#804060',
    letterSpacing: 0.3,
    textAlign: 'center',
    includeFontPadding: false,
    lineHeight: 11,
  },
  tabLabelActive: {
    color: '#FF4D8D',
    fontWeight: '700',
  },
  activeDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginTop: 2,
  },
  activeDotVisible: {
    backgroundColor: '#FF4D8D',
    shadowColor: '#FF4D8D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 3,
  },
  tabBadge: {
    position: 'absolute',
    top: -3,
    right: -6,
    minWidth: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#FF4D6D',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    lineHeight: 10,
  },

  centerTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 3,
    minHeight: 54,
  },
  centerGlowRing: {
    position: 'absolute',
    top: -14,
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.5)',
    backgroundColor: 'rgba(255,77,141,0.06)',
    shadowColor: '#FF4D8D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 0,
  },
  centerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E0F18',
    borderWidth: 2,
    borderColor: 'rgba(255,77,141,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: -18,
    shadowColor: '#FF4D8D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
  },
  centerButtonActive: {
    borderColor: '#FF4D8D',
    backgroundColor: 'rgba(255,77,141,0.2)',
    shadowOpacity: 0.75,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  centerLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#804060',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 2,
    includeFontPadding: false,
    lineHeight: 10,
  },
  centerLabelActive: {
    color: '#FF4D8D',
    shadowColor: '#FF4D8D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});
