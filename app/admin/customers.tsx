import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, X, ChevronRight } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';

type Customer = {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  orders: any[];
  total_spent: number;
};

function initials(first: string, last: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
}

function CustomersContent() {
  const { t, language } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data: orders } = await supabase
      .from('orders')
      .select('customer_email, customer_first_name, customer_last_name, customer_phone, total, status, created_at, id')
      .order('created_at', { ascending: false });
    const map: Record<string, Customer> = {};
    (orders ?? []).forEach((o: any) => {
      if (!map[o.customer_email]) {
        map[o.customer_email] = {
          email: o.customer_email,
          first_name: o.customer_first_name,
          last_name: o.customer_last_name,
          phone: o.customer_phone ?? '',
          orders: [],
          total_spent: 0,
        };
      }
      map[o.customer_email].orders.push(o);
      map[o.customer_email].total_spent += Number(o.total) || 0;
    });
    setCustomers(Object.values(map));
    setLoading(false);
  };

  const filtered = customers.filter(
    (c) =>
      search.trim() === '' ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) {
    return (
      <View style={styles.detailContainer}>
        <TouchableOpacity style={styles.backRow} onPress={() => setSelected(null)} activeOpacity={0.7}>
          <Text style={styles.backLink}>{t.backToCustomers}</Text>
        </TouchableOpacity>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(selected.first_name, selected.last_name)}</Text>
          </View>
          <Text style={styles.profileName}>{selected.first_name} {selected.last_name}</Text>
          <Text style={styles.profileEmail}>{selected.email}</Text>
          {selected.phone !== '' && (
            <Text style={styles.profilePhone}>{selected.phone}</Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>{selected.orders.length}</Text>
            <Text style={styles.statBoxLabel}>{t.ordersStatLabel}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statBoxValue, { color: Colors.neonBlue }]}>
              {formatPrice(selected.total_spent, language)}
            </Text>
            <Text style={styles.statBoxLabel}>{t.totalSpentLabel}</Text>
          </View>
        </View>

        <Text style={styles.subTitle}>{t.orderHistoryLabel}</Text>
        {selected.orders.map((order, idx) => (
          <View key={order.id ?? idx} style={styles.orderHistoryRow}>
            <View style={styles.orderHistoryLeft}>
              <Text style={styles.orderHistoryDate}>
                {new Date(order.created_at).toLocaleDateString()}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(order.status) + '22' }]}>
                <Text style={[styles.statusBadgeText, { color: statusColor(order.status) }]}>
                  {order.status}
                </Text>
              </View>
            </View>
            <Text style={styles.orderHistoryAmount}>{formatPrice(Number(order.total), language)}</Text>
          </View>
        ))}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.neonBlue} size="large" />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.searchBox}>
        <Search size={16} color={Colors.textMuted} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t.searchCustomers}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search !== '' && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={16} color={Colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {filtered.length === 0 ? (
        <Text style={styles.emptyText}>{t.noCustomersFound}</Text>
      ) : (
        filtered.map((c) => (
          <TouchableOpacity
            key={c.email}
            style={styles.customerCard}
            onPress={() => setSelected(c)}
            activeOpacity={0.8}
          >
            <View style={styles.avatarSmall}>
              <Text style={styles.avatarSmallText}>{initials(c.first_name, c.last_name)}</Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{c.first_name} {c.last_name}</Text>
              <Text style={styles.customerEmail} numberOfLines={1}>{c.email}</Text>
              <Text style={styles.customerMeta}>{c.orders.length} {t.ordersAndSpent}{formatPrice(c.total_spent, language)}</Text>
            </View>
            <ChevronRight size={16} color={Colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    pending: Colors.warning,
    processing: Colors.neonBlue,
    shipped: '#7C83FF',
    delivered: Colors.success,
    cancelled: Colors.error,
  };
  return map[s] ?? Colors.textMuted;
}

function CustomersScreen() {
  const { t } = useLanguage();
  const { isMobile } = useAdminLayout();

  if (isMobile) {
    return (
      <AdminMobileDashboard title={t.customers} showBack>
        <CustomersContent />
      </AdminMobileDashboard>
    );
  }

  return (
    <AdminWebDashboard title={t.customers}>
      <CustomersContent />
    </AdminWebDashboard>
  );
}

export default function CustomersScreenGuarded() {
  return (
    <AdminGuard permission="manage_customers">
      <CustomersScreen />
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    padding: 0,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSmallText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  customerEmail: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  customerMeta: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  detailContainer: {
    paddingBottom: 40,
  },
  backRow: {
    marginBottom: Spacing.md,
  },
  backLink: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  profileCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: 4,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 2,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  avatarText: {
    color: Colors.neonBlue,
    fontSize: FontSize.xl,
    fontWeight: '900',
  },
  profileName: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
  },
  profileEmail: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  profilePhone: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statBoxValue: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  statBoxLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  subTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  orderHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  orderHistoryLeft: {
    gap: 4,
  },
  orderHistoryDate: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  orderHistoryAmount: {
    color: Colors.neonBlue,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
});
