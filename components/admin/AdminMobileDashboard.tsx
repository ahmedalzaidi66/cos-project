import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Settings,
} from 'lucide-react-native';
import AdminMobileLayout from '@/components/admin/AdminMobileLayout';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';

const QUICK_NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, route: '/admin/dashboard' },
  { label: 'Orders',    icon: ShoppingCart,    route: '/admin/orders' },
  { label: 'Customers', icon: Users,           route: '/admin/customers' },
  { label: 'Products',  icon: Package,         route: '/admin/products' },
  { label: 'Settings',  icon: Settings,        route: '/admin/settings' },
] as const;

type Props = {
  title: string;
  subtitle?: string;
  /** Explicitly override back button. Omit to auto-detect from route. */
  showBack?: boolean;
  showQuickNav?: boolean;
  children: React.ReactNode;
};

export default function AdminMobileDashboard({ title, showBack, showQuickNav, children }: Props) {
  const router = useRouter();
  const { t } = useLanguage();

  const navLabelMap: Record<string, string> = {
    'Dashboard': t.dashboard,
    'Orders': t.ordersAdmin,
    'Customers': t.customers,
    'Products': t.products,
    'Settings': t.settings,
  };

  return (
    // showBack is passed through; AdminMobileLayout auto-detects if undefined
    <AdminMobileLayout title={title} showBack={showBack}>
      {children}
      {showQuickNav && (
        <View style={styles.quickNav}>
          <Text style={styles.quickNavTitle}>{t.quickNavigation}</Text>
          <View style={styles.quickNavGrid}>
            {QUICK_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.route}
                  style={styles.quickNavCard}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.quickNavIcon}>
                    <Icon size={20} color={Colors.neonBlue} strokeWidth={2} />
                  </View>
                  <Text style={styles.quickNavLabel}>{navLabelMap[item.label] ?? item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </AdminMobileLayout>
  );
}

const styles = StyleSheet.create({
  quickNav: {
    marginTop: Spacing.lg,
  },
  quickNavTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  quickNavGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickNavCard: {
    width: '47%',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  quickNavIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  quickNavLabel: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
});
