import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  Animated,
  I18nManager,
  Image,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  House,
  ShoppingCart,
  User,
  Sparkles,
  Camera,
  ShieldCheck,
  X,
  ShoppingBag,
  ChevronDown,
  Package,
  Droplet,
  Palette,
  Flower2,
  Pipette,
  Tag,
  Info,
  ChevronRight,
} from 'lucide-react-native';
import { useCart } from '@/context/CartContext';
import { useCMS } from '@/context/CMSContext';
import { useLanguage } from '@/context/LanguageContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { fetchCategories, getCategoryName, Category } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryWithCount = Category & { product_count: number };

type Props = {
  visible: boolean;
  onClose: () => void;
};

// ─── Slug → icon mapping ─────────────────────────────────────────────────────

function CategoryIcon({ slug, size, color }: { slug: string; size: number; color: string }) {
  const props = { size, color, strokeWidth: 1.8 };
  if (slug === 'makeup') return <Palette {...props} />;
  if (slug === 'skincare') return <Flower2 {...props} />;
  if (slug === 'haircare') return <Droplet {...props} />;
  if (slug === 'fragrances') return <Sparkles {...props} />;
  if (slug === 'tools') return <Pipette {...props} />;
  return <Tag {...props} />;
}

// ─── Main nav items built at render time using translations ──────────────────

type NavItem = { label: string; icon: React.ComponentType<any>; route: string };

function getMainNav(t: { navHome: string; navCanopyFinder: string; navAccount: string; navAbout: string }): NavItem[] {
  return [
    { label: t.navHome, icon: House, route: '/(tabs)/' },
    { label: t.navCanopyFinder, icon: Camera, route: '/(tabs)/canopy' },
    { label: t.navAccount, icon: User, route: '/(tabs)/account' },
    { label: t.navAbout, icon: Info, route: '/(tabs)/about' },
  ];
}

// ─── Accordion component ──────────────────────────────────────────────────────

type AccordionProps = {
  expanded: boolean;
  maxHeight: number;
  children: React.ReactNode;
};

function Accordion({ expanded, maxHeight, children }: AccordionProps) {
  const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  return (
    <Animated.View
      style={{
        height: anim.interpolate({ inputRange: [0, 1], outputRange: [0, maxHeight] }),
        overflow: 'hidden',
        opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.8, 1] }),
      }}
    >
      {children}
    </Animated.View>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

export default function NavigationDrawer({ visible, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { totalItems } = useCart();
  const { branding } = useCMS();
  const { language, t } = useLanguage();
  const isRTL = I18nManager.isRTL;
  const MAIN_NAV = getMainNav(t);

  const [productsOpen, setProductsOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const chevronAnim = useRef(new Animated.Value(0)).current;

  // Load categories + counts once on mount
  useEffect(() => {
    async function load() {
      const [cats, { data: countRows }] = await Promise.all([
        fetchCategories(language),
        supabase.rpc
          ? supabase.from('products').select('category').eq('status', 'active')
          : Promise.resolve({ data: [] as any[] }),
      ]);

      // Count products per category slug
      const countMap: Record<string, number> = {};
      if (countRows) {
        for (const row of countRows as { category: string }[]) {
          countMap[row.category] = (countMap[row.category] ?? 0) + 1;
        }
      }

      setCategories(
        cats.map(c => ({ ...c, product_count: countMap[c.slug] ?? 0 }))
      );
    }
    load();
  }, [language]);

  useEffect(() => {
    Animated.timing(chevronAnim, {
      toValue: productsOpen ? 1 : 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [productsOpen]);

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: isRTL ? ['0deg', '-180deg'] : ['0deg', '180deg'],
  });

  const handleNav = useCallback((route: string) => {
    onClose();
    setSelectedCategory(null);
    setTimeout(() => router.push(route as any), 55);
  }, [onClose, router]);

  const handleAllProducts = useCallback(() => {
    onClose();
    setSelectedCategory(null);
    setProductsOpen(false);
    setTimeout(() => router.push('/(tabs)/products' as any), 55);
  }, [onClose, router]);

  const handleCategory = useCallback((slug: string) => {
    onClose();
    setSelectedCategory(slug);
    setProductsOpen(false);
    setTimeout(() => router.push({ pathname: '/(tabs)/products', params: { category: slug } } as any), 55);
  }, [onClose, router]);

  const isRouteActive = useCallback((route: string) => {
    const bare = route.replace('/(tabs)/', '').replace('/(tabs)', '');
    if (bare === '/' || bare === '') return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/';
    return pathname.includes(bare);
  }, [pathname]);

  const isProductsActive = pathname.includes('products');

  // Height: "All Products" row + each category row + bottom padding
  const accordionMaxH = 54 + categories.length * 52 + 8;

  const drawerStyle = [
    styles.drawer,
    isRTL && styles.drawerRTL,
  ];

  const overlayStyle = [
    styles.overlay,
    isRTL && styles.overlayRTL,
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={overlayStyle} onPress={onClose}>
        <Pressable style={drawerStyle} onPress={e => e.stopPropagation()}>
          <SafeAreaView style={styles.safeArea}>

            {/* ── Header ─────────────────────────────────────────────── */}
            <View style={[styles.header, isRTL && styles.headerRTL]}>
              {branding.logo_url ? (
                <Image
                  source={{ uri: branding.logo_url }}
                  style={styles.drawerLogo}
                  resizeMode="contain"
                />
              ) : (
                <View>
                  <Text style={styles.brandName}>{branding.app_name || 'LAZURDE'}</Text>
                  <Text style={styles.brandTagline}>{branding.app_tagline || 'MAKEUP'}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <X size={20} color={Colors.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* ── Home ─────────────────────────────────────────────── */}
              {MAIN_NAV.slice(0, 1).map(({ label, icon: Icon, route }) => {
                const active = isRouteActive(route);
                return (
                  <NavRow
                    key={route}
                    label={label}
                    icon={<Icon size={20} color={active ? Colors.neonBlue : Colors.textSecondary} strokeWidth={2} />}
                    active={active}
                    isRTL={isRTL}
                    onPress={() => handleNav(route)}
                  />
                );
              })}

              {/* ── Products accordion trigger ────────────────────────── */}
              <TouchableOpacity
                style={[
                  styles.navRow,
                  isProductsOpen(isProductsActive, productsOpen) && styles.navRowActive,
                  isRTL && styles.navRowRTL,
                ]}
                onPress={() => setProductsOpen(v => !v)}
                activeOpacity={0.75}
              >
                {isProductsOpen(isProductsActive, productsOpen) && (
                  <View style={[styles.activeBar, isRTL && styles.activeBarRTL]} />
                )}
                <ShoppingBag
                  size={20}
                  color={(isProductsActive || productsOpen) ? Colors.neonBlue : Colors.textSecondary}
                  strokeWidth={2}
                />
                <Text
                  style={[
                    styles.navLabel,
                    (isProductsActive || productsOpen) && styles.navLabelActive,
                    { flex: 1, textAlign: isRTL ? 'right' : 'left' },
                  ]}
                >
                  {t.navProducts}
                </Text>
                <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                  <ChevronDown
                    size={16}
                    color={(isProductsActive || productsOpen) ? Colors.neonBlue : Colors.textMuted}
                    strokeWidth={2.5}
                  />
                </Animated.View>
              </TouchableOpacity>

              {/* ── Accordion body ────────────────────────────────────── */}
              <Accordion expanded={productsOpen} maxHeight={accordionMaxH}>
                <View style={styles.accordionBody}>

                  {/* All Products row */}
                  <TouchableOpacity
                    style={[
                      styles.categoryRow,
                      !selectedCategory && isProductsActive && styles.categoryRowActive,
                      isRTL && styles.categoryRowRTL,
                    ]}
                    onPress={handleAllProducts}
                    activeOpacity={0.75}
                  >
                    <Package
                      size={16}
                      color={!selectedCategory && isProductsActive ? Colors.neonBlue : Colors.textSecondary}
                      strokeWidth={1.8}
                    />
                    <Text
                      style={[
                        styles.categoryLabel,
                        !selectedCategory && isProductsActive && styles.categoryLabelActive,
                        { flex: 1, textAlign: isRTL ? 'right' : 'left' },
                      ]}
                    >
                      {t.navAllProducts}
                    </Text>
                    <ChevronRight
                      size={13}
                      color={Colors.textMuted}
                      strokeWidth={2}
                      style={{ transform: isRTL ? [{ scaleX: -1 }] : [] }}
                    />
                  </TouchableOpacity>

                  {/* Per-category rows */}
                  {categories.map(cat => {
                    const catActive = selectedCategory === cat.slug && isProductsActive;
                    const label = getCategoryName(cat, language);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryRow,
                          catActive && styles.categoryRowActive,
                          isRTL && styles.categoryRowRTL,
                        ]}
                        onPress={() => handleCategory(cat.slug)}
                        activeOpacity={0.75}
                      >
                        <CategoryIcon
                          slug={cat.slug}
                          size={16}
                          color={catActive ? Colors.neonBlue : Colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.categoryLabel,
                            catActive && styles.categoryLabelActive,
                            { flex: 1, textAlign: isRTL ? 'right' : 'left' },
                          ]}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                        {cat.product_count > 0 && (
                          <View style={styles.countBadge}>
                            <Text style={styles.countText}>{cat.product_count}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Accordion>

              {/* ── Remaining nav items ───────────────────────────────── */}
              {MAIN_NAV.slice(1).map(({ label, icon: Icon, route }) => {
                const active = isRouteActive(route);
                return (
                  <NavRow
                    key={route}
                    label={label}
                    icon={<Icon size={20} color={active ? Colors.neonBlue : Colors.textSecondary} strokeWidth={2} />}
                    active={active}
                    isRTL={isRTL}
                    onPress={() => handleNav(route)}
                  />
                );
              })}

              {/* Cart row with badge */}
              <NavRow
                label={t.navCart}
                icon={
                  <View style={{ position: 'relative' }}>
                    <ShoppingCart
                      size={20}
                      color={isRouteActive('/(tabs)/cart') ? Colors.neonBlue : Colors.textSecondary}
                      strokeWidth={2}
                    />
                    {totalItems > 0 && (
                      <View style={styles.cartBadge}>
                        <Text style={styles.cartBadgeText}>
                          {totalItems > 99 ? '99+' : totalItems}
                        </Text>
                      </View>
                    )}
                  </View>
                }
                active={isRouteActive('/(tabs)/cart')}
                isRTL={isRTL}
                onPress={() => handleNav('/(tabs)/cart')}
              />

              <View style={styles.divider} />

              {/* ── Admin ─────────────────────────────────────────────── */}
              <TouchableOpacity
                style={[styles.adminBtn, isRTL && styles.adminBtnRTL]}
                onPress={() => handleNav('/admin')}
                activeOpacity={0.75}
              >
                <ShieldCheck size={18} color={Colors.neonBlue} strokeWidth={2} />
                <Text style={styles.adminLabel}>{t.navAdminPanel}</Text>
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Helper: is the products section highlighted ──────────────────────────────

function isProductsOpen(isActive: boolean, isExpanded: boolean) {
  return isActive || isExpanded;
}

// ─── NavRow sub-component ─────────────────────────────────────────────────────

function NavRow({
  label, icon, active, isRTL, onPress,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  isRTL: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.navRow, active && styles.navRowActive, isRTL && styles.navRowRTL]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {active && <View style={[styles.activeBar, isRTL && styles.activeBarRTL]} />}
      {icon}
      <Text
        style={[
          styles.navLabel,
          active && styles.navLabelActive,
          { flex: 1, textAlign: isRTL ? 'right' : 'left' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
  },
  overlayRTL: {
    flexDirection: 'row-reverse',
  },
  drawer: {
    width: 280,
    backgroundColor: Colors.backgroundSecondary,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  drawerRTL: {
    borderRightWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    shadowOffset: { width: -4, height: 0 },
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? Spacing.xl : 0,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  drawerLogo: {
    height: 40,
    width: 110,
  },
  brandName: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  brandTagline: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
  },

  scroll: {
    flex: 1,
  },

  // ── Nav rows ─────────────────────────────────────────────────────────────────
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 15,
    marginHorizontal: Spacing.sm,
    marginVertical: 1,
    borderRadius: Radius.md,
    position: 'relative',
  },
  navRowRTL: {
    flexDirection: 'row-reverse',
  },
  navRowActive: {
    backgroundColor: Colors.neonBlueGlow,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    backgroundColor: Colors.neonBlue,
    borderRadius: 2,
  },
  activeBarRTL: {
    left: undefined,
    right: 0,
  },
  navLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  navLabelActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },

  // ── Accordion body ────────────────────────────────────────────────────────────
  accordionBody: {
    marginHorizontal: Spacing.sm,
    marginBottom: 4,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  categoryRowRTL: {
    flexDirection: 'row-reverse',
  },
  categoryRowActive: {
    backgroundColor: Colors.neonBlueGlow,
  },
  categoryLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  categoryLabelActive: {
    color: Colors.neonBlue,
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,77,141,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  countText: {
    color: Colors.neonBlue,
    fontSize: 10,
    fontWeight: '700',
  },

  // ── Cart badge ────────────────────────────────────────────────────────────────
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -8,
    backgroundColor: Colors.neonBlue,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  cartBadgeText: {
    color: Colors.background,
    fontSize: 9,
    fontWeight: '800',
  },

  // ── Admin button ──────────────────────────────────────────────────────────────
  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    marginHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  adminBtnRTL: {
    flexDirection: 'row-reverse',
  },
  adminLabel: {
    color: Colors.neonBlue,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
