import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  SafeAreaView,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  UserCog,
  File as FileEdit,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  ChevronLeft,
  MessageSquare,
  Tag,
  ShieldAlert,
  Truck,
  Bell,
  LayoutList,
} from 'lucide-react-native';
import { useAdmin, ROLE_LABELS } from '@/context/AdminContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/context/LanguageContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

const DRAWER_WIDTH = 280;
const NO_BACK_ROUTES = new Set(['/admin', '/admin/dashboard', '/admin/index']);

// useNativeDriver only works on native — on web it must be false
const USE_NATIVE = Platform.OS !== 'web';

const MOBILE_NAV_ITEMS = [
  { key: 'dashboard',   icon: LayoutDashboard, route: '/admin/dashboard',   permission: 'view_dashboard' },
  { key: 'products',    icon: Package,         route: '/admin/products',    permission: 'manage_products' },
  { key: 'ordersAdmin', icon: ShoppingCart,    route: '/admin/orders',      permission: 'manage_orders' },
  { key: 'customers',       icon: Users,  route: '/admin/customers',       permission: 'manage_customers' },
  { key: 'notifications',   icon: Bell,   route: '/admin/notifications',   permission: 'manage_customers' },
  { key: 'employees',   icon: UserCog,         route: '/admin/employees',   permission: 'manage_employees' },
  { key: 'reviews',     icon: MessageSquare,   route: '/admin/reviews',     permission: 'manage_reviews' },
  { key: 'coupons',     icon: Tag,             route: '/admin/coupons',     permission: 'manage_coupons' },
  { key: 'shipping',    icon: Truck,           route: '/admin/shipping',    permission: 'manage_orders' },
  { key: 'homeSections', icon: LayoutList,      route: '/admin/sections',    permission: 'manage_cms' },
  { key: 'content',     icon: FileEdit,        route: '/admin/content',     permission: 'manage_cms' },
  { key: 'settings',    icon: Settings,        route: '/admin/settings',    permission: 'manage_settings' },
  { key: 'permissions', icon: ShieldAlert,     route: '/admin/permissions', permission: 'manage_permissions' },
] as const;

const ROLE_COLORS: Record<string, string> = {
  super_admin:      Colors.gold,
  admin:            Colors.gold,
  employee:         Colors.neonBlue,
  product_manager:  '#A78BFA',
  order_manager:    Colors.success,
  customer_support: Colors.warning,
  content_editor:   '#60CDFF',
};

type Props = {
  children: React.ReactNode;
  title: string;
  showBack?: boolean;
};

export default function AdminMobileLayout({ children, title, showBack }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin, adminLogout } = useAdmin();
  const { hasPermission } = usePermissions();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();

  const roleKey = admin?.role ?? '';
  const roleLabel = ROLE_LABELS[roleKey] ?? roleKey.replace(/_/g, ' ');
  const roleBadgeColor = ROLE_COLORS[roleKey] ?? Colors.textMuted;
  const visibleItems = MOBILE_NAV_ITEMS.filter((item) => hasPermission(item.permission));

  // Drawer is always mounted — animation moves it on/off screen
  // This avoids the race condition where Animated starts before the View mounts
  const [drawerOpen, setDrawerOpen] = useState(false);
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('[AdminMobileLayout] mounted, width:', width, 'path:', pathname);
  }, []);

  const shouldShowBack = showBack !== undefined
    ? showBack
    : !NO_BACK_ROUTES.has(pathname);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 240,
        useNativeDriver: USE_NATIVE,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: USE_NATIVE,
      }),
    ]).start();
  }, [translateX, overlayOpacity]);

  const closeDrawer = useCallback((onDone?: () => void) => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: USE_NATIVE,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: USE_NATIVE,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setDrawerOpen(false);
        onDone?.();
      }
    });
  }, [translateX, overlayOpacity]);

  // Close drawer on route change
  useEffect(() => {
    if (drawerOpen) {
      closeDrawer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleNavPress = useCallback((route: string) => {
    // Navigate immediately; route change useEffect will close drawer
    setDrawerOpen(false);
    translateX.setValue(-DRAWER_WIDTH);
    overlayOpacity.setValue(0);
    router.push(route as any);
  }, [translateX, overlayOpacity, router]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/admin/dashboard');
    }
  }, [router]);

  const handleLogout = useCallback(() => {
    closeDrawer(() => {
      adminLogout();
      router.replace('/admin/login');
    });
  }, [closeDrawer, adminLogout, router]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeTop} />

      {/* Top bar — full width, no sidebar offset */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          {shouldShowBack && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              activeOpacity={0.6}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <ChevronLeft size={22} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={openDrawer}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Menu size={22} color={Colors.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <Text style={styles.topBarTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.topBarRight} />
      </View>

      {/* Full-width content — zero left offset */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentInner}
      >
        {children}
      </ScrollView>

      {/* Overlay — always rendered, invisible and non-interactive when drawer closed */}
      {drawerOpen && (
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeDrawer()} />
        </Animated.View>
      )}

      {/* Drawer panel — always mounted, translated off-screen when closed */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <SafeAreaView style={styles.drawerInner}>
          {/* Header */}
          <View style={styles.drawerHeader}>
            <View style={styles.logoRow}>
              <ShieldCheck size={20} color={Colors.neonBlue} strokeWidth={2} />
              <Text style={styles.logoText}>Admin Panel</Text>
            </View>
            <Text style={styles.drawerSubText} numberOfLines={1}>
              {admin?.name ?? admin?.email}
            </Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => closeDrawer()}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Nav items */}
          <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.route;
              return (
                <TouchableOpacity
                  key={item.route}
                  style={[styles.navItem, active && styles.navItemActive]}
                  onPress={() => handleNavPress(item.route)}
                  activeOpacity={0.7}
                >
                  {active && <View style={styles.activeBar} />}
                  <Icon
                    size={18}
                    color={active ? Colors.neonBlue : Colors.textSecondary}
                    strokeWidth={2}
                  />
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                    {(t as any)[item.key] ?? item.key}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={styles.drawerFooter}>
            <View style={styles.adminCard}>
              <View style={[styles.avatar, { backgroundColor: roleBadgeColor }]}>
                <Text style={styles.avatarText}>
                  {(admin?.name ?? 'A')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.avatarName} numberOfLines={1}>
                  {admin?.name ?? 'Admin'}
                </Text>
                <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor + '22', borderColor: roleBadgeColor + '55' }]}>
                  <Text style={[styles.roleBadgeText, { color: roleBadgeColor }]}>{roleLabel}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <LogOut size={16} color={Colors.error} strokeWidth={2} />
              <Text style={styles.logoutText}>{t.signOut}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    // No flexDirection: 'row' — never a sidebar column
    overflow: 'hidden',
  },
  safeTop: {
    backgroundColor: Colors.backgroundSecondary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
    gap: 2,
  },
  topBarTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  topBarRight: {
    minWidth: 80,
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(5,10,20,0.82)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,224,255,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  content: {
    flex: 1,
    width: '100%',
  },
  contentInner: {
    padding: Spacing.md,
    paddingBottom: 48,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 100,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.backgroundSecondary,
    zIndex: 101,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 24,
  },
  drawerInner: {
    flex: 1,
  },
  drawerHeader: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    position: 'relative',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
    paddingRight: 36,
  },
  logoText: {
    color: Colors.neonBlue,
    fontSize: FontSize.md,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  drawerSubText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navList: {
    flex: 1,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    marginHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    position: 'relative',
    overflow: 'hidden',
  },
  navItemActive: {
    backgroundColor: Colors.neonBlueGlow,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    backgroundColor: Colors.neonBlue,
    borderRadius: 2,
  },
  navLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    flex: 1,
  },
  navLabelActive: {
    color: Colors.neonBlue,
  },
  drawerFooter: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
    paddingBottom: 28,
  },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.neonBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.background,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  avatarName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginBottom: 3,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  logoutText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
