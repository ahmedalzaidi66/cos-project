import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useRouter } from 'expo-router';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  Clock,
  CircleCheck as CheckCircle,
  Truck,
  CircleAlert as AlertCircle,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react-native';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';

type Stats = {
  totalOrders: number;
  newOrders: number;
  totalSales: number;
  totalProducts: number;
  lowStockProducts: number;
  shippedOrders: number;
  deliveredOrders: number;
};

const LOW_STOCK_THRESHOLD = 5;

const STATUS_COLORS: Record<string, string> = {
  new: Colors.neonBlue,
  pending: Colors.warning,
  confirmed: '#4ADE80',
  preparing: Colors.warning,
  processing: Colors.neonBlue,
  shipped: '#7C83FF',
  delivered: Colors.success,
  cancelled: Colors.error,
};

function statusColor(s: string) {
  return STATUS_COLORS[s] ?? Colors.textMuted;
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    new: 'جديد',
    confirmed: 'مؤكد',
    preparing: 'قيد التحضير',
    shipped: 'مشحون',
    delivered: 'مُسلَّم',
    cancelled: 'ملغى',
    pending: 'معلق',
    processing: 'قيد المعالجة',
  };
  return map[s] ?? s;
}

function DashboardContent() {
  const router = useRouter();
  const { language } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsRes, ordersRes] = await Promise.all([
        supabase.from('products').select('id, stock', { count: 'exact' }),
        supabase
          .from('orders')
          .select('id, total, status, created_at, customer_first_name, customer_last_name, payment_method')
          .order('created_at', { ascending: false }),
      ]);

      if (ordersRes.error) throw new Error(ordersRes.error.message);

      const allOrders = ordersRes.data ?? [];
      const allProducts = productsRes.data ?? [];
      const totalSales = allOrders
        .filter((o: any) => o.status !== 'cancelled')
        .reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);

      setStats({
        totalOrders: allOrders.length,
        newOrders: allOrders.filter((o: any) => o.status === 'new').length,
        totalSales,
        totalProducts: allProducts.length,
        lowStockProducts: allProducts.filter((p: any) => (p.stock ?? 0) <= LOW_STOCK_THRESHOLD).length,
        shippedOrders: allOrders.filter((o: any) => o.status === 'shipped').length,
        deliveredOrders: allOrders.filter((o: any) => o.status === 'delivered').length,
      });
      setRecentOrders(allOrders.slice(0, 6));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.neonBlue} size="large" />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorState}>
        <AlertCircle size={36} color={Colors.error} strokeWidth={1.5} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchStats} activeOpacity={0.8}>
          <RefreshCw size={15} color={Colors.background} strokeWidth={2} />
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Primary stats row */}
      <View style={styles.statsGrid}>
        <StatCard
          label="إجمالي الطلبات"
          value={stats?.totalOrders ?? 0}
          icon={<ShoppingCart size={20} color={Colors.success} strokeWidth={2} />}
          color={Colors.success}
          onPress={() => router.push('/admin/orders')}
        />
        <StatCard
          label="طلبات جديدة"
          value={stats?.newOrders ?? 0}
          icon={<Clock size={20} color={Colors.neonBlue} strokeWidth={2} />}
          color={Colors.neonBlue}
          onPress={() => router.push('/admin/orders')}
          highlight={stats?.newOrders ? stats.newOrders > 0 : false}
        />
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          label="إجمالي المنتجات"
          value={stats?.totalProducts ?? 0}
          icon={<Package size={20} color="#7C83FF" strokeWidth={2} />}
          color="#7C83FF"
          onPress={() => router.push('/admin/products')}
        />
        <StatCard
          label="مخزون منخفض"
          value={stats?.lowStockProducts ?? 0}
          icon={<AlertCircle size={20} color={Colors.warning} strokeWidth={2} />}
          color={Colors.warning}
          onPress={() => router.push('/admin/products')}
          highlight={stats?.lowStockProducts ? stats.lowStockProducts > 0 : false}
        />
      </View>

      {/* Total Sales */}
      <View style={styles.revenueCard}>
        <View style={styles.revenueRow}>
          <TrendingUp size={20} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.revenueLabel}>إجمالي المبيعات</Text>
        </View>
        <Text style={styles.revenueValue}>
          {formatPrice(stats?.totalSales ?? 0, language)}
        </Text>
        <Text style={styles.revenueHint}>لا يشمل الطلبات الملغاة</Text>
      </View>

      {/* Status pills */}
      <View style={styles.statusRow}>
        <StatusPill
          label="مشحون"
          count={stats?.shippedOrders ?? 0}
          color="#7C83FF"
          icon={<Truck size={13} color="#7C83FF" strokeWidth={2} />}
        />
        <StatusPill
          label="مُسلَّم"
          count={stats?.deliveredOrders ?? 0}
          color={Colors.success}
          icon={<CheckCircle size={13} color={Colors.success} strokeWidth={2} />}
        />
        <StatusPill
          label="جديد"
          count={stats?.newOrders ?? 0}
          color={Colors.neonBlue}
          icon={<ShoppingBag size={13} color={Colors.neonBlue} strokeWidth={2} />}
        />
      </View>

      {/* Recent orders */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>أحدث الطلبات</Text>
          <TouchableOpacity onPress={() => router.push('/admin/orders')} activeOpacity={0.7}>
            <Text style={styles.seeAll}>عرض الكل</Text>
          </TouchableOpacity>
        </View>
        {recentOrders.length === 0 ? (
          <View style={styles.emptyBox}>
            <ShoppingCart size={28} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyText}>لا توجد طلبات حتى الآن</Text>
          </View>
        ) : (
          recentOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderRow}
              onPress={() => router.push('/admin/orders')}
              activeOpacity={0.75}
            >
              <View style={styles.orderLeft}>
                <Text style={styles.orderName}>
                  {order.customer_first_name} {order.customer_last_name}
                </Text>
                <View style={styles.orderMeta}>
                  {order.payment_method === 'cod' && (
                    <View style={styles.codTag}>
                      <Text style={styles.codTagText}>COD</Text>
                    </View>
                  )}
                  <Text style={styles.orderDate}>
                    {new Date(order.created_at).toLocaleDateString('ar-EG')}
                  </Text>
                </View>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderTotal}>{formatPrice(Number(order.total), language)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(order.status) + '22' }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor(order.status) }]}>
                    {statusLabel(order.status)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Quick nav */}
      <View style={styles.quickGrid}>
        {[
          { label: 'إدارة الطلبات', route: '/admin/orders' },
          { label: 'المنتجات', route: '/admin/products' },
          { label: 'العملاء', route: '/admin/customers' },
          { label: 'الإعدادات', route: '/admin/settings' },
        ].map((link) => (
          <TouchableOpacity
            key={link.route}
            style={styles.quickBtn}
            onPress={() => router.push(link.route as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickBtnText}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function DashboardScreen() {
  const { isMobile } = useAdminLayout();

  if (isMobile) {
    return (
      <AdminMobileDashboard title="لوحة التحكم" showQuickNav>
        <DashboardContent />
      </AdminMobileDashboard>
    );
  }

  return (
    <AdminWebDashboard title="لوحة التحكم">
      <DashboardContent />
    </AdminWebDashboard>
  );
}

export default function DashboardScreenGuarded() {
  return (
    <AdminGuard permission="view_dashboard">
      <DashboardScreen />
    </AdminGuard>
  );
}

function StatCard({
  label, value, icon, color, onPress, highlight,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.statCard, { borderColor: color + '35' }, highlight && { borderColor: color + '70' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.statIcon, { backgroundColor: color + '1A' }]}>{icon}</View>
      <Text style={[styles.statValue, highlight && { color }]}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusPill({
  label, count, color, icon,
}: {
  label: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <View style={[styles.statusPillCard, { borderColor: color + '30' }]}>
      {icon}
      <Text style={[styles.statusPillCount, { color }]}>{count}</Text>
      <Text style={styles.statusPillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  centered: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  errorState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.md,
    textAlign: 'center',
    maxWidth: 340,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.neonBlue,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  retryBtnText: {
    color: Colors.background,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl + 2,
    fontWeight: '900',
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
  },
  revenueCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    marginBottom: Spacing.sm,
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  revenueLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  revenueValue: {
    color: Colors.neonBlue,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  revenueHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statusPillCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    alignItems: 'center',
    gap: 3,
  },
  statusPillCount: {
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  statusPillLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  section: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  seeAll: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  orderLeft: {
    flex: 1,
    marginRight: Spacing.sm,
    gap: 4,
  },
  orderName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codTag: {
    backgroundColor: Colors.success + '20',
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  codTagText: {
    color: Colors.success,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  orderDate: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  orderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderTotal: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  quickBtnText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
