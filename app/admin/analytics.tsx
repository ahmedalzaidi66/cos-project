import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { ChartBar as BarChart3, CircleAlert as AlertCircle, Coins, Crown, Eye, MousePointerClick, Package, RefreshCw, Repeat2, ShoppingBag, ShoppingCart, Sparkles, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react-native';
import { TIER_COLORS } from '@/lib/loyalty';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useLanguage } from '@/context/LanguageContext';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import { adminSupabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/currency';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = 'today' | '7d' | '30d' | 'all';

type OverviewStats = {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  totalVisitors: number;
  abandonedCarts: number;
  tryOnUsage: number;
  conversionRate: number;
  avgOrderValue: number;
  revenueChange: number;
  ordersChange: number;
};

type DayPoint = {
  label: string;
  orders: number;
  revenue: number;
};

type TopProduct = {
  product_id: string;
  product_name: string;
  units_sold: number;
  revenue: number;
};

type TopShade = {
  shade_name: string;
  shade_hex: string;
  category: string;
  count: number;
};

type AbandonedCart = {
  id: string;
  session_id: string;
  total_value: number;
  item_count: number;
  created_at: string;
  items: any[];
};

type MostViewed = {
  product_name: string;
  product_id: string;
  views: number;
};

type LoyaltyAnalytics = {
  total_points_issued: number;
  total_points_redeemed: number;
  total_members: number;
  active_members_90d: number;
  avg_balance: number;
  redemption_rate_pct: number;
  repeat_purchase_rate_pct: number;
  tier_distribution: Record<string, number>;
  top_earners: Array<{ user_id: string; email: string | null; total_points: number; lifetime_points: number; tier: string }>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function periodToInterval(p: Period): string | null {
  if (p === 'today') return '1 day';
  if (p === '7d') return '7 days';
  if (p === '30d') return '30 days';
  return null; // all time
}

function periodLabel(p: Period): string {
  if (p === 'today') return 'Today';
  if (p === '7d') return 'Last 7 days';
  if (p === '30d') return 'Last 30 days';
  return 'All time';
}

function shortDate(iso: string, p: Period): string {
  const d = new Date(iso);
  if (p === 'today') return d.getHours() + ':00';
  return (d.getMonth() + 1) + '/' + d.getDate();
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

// ── Skeleton shimmer ──────────────────────────────────────────────────────────

function SkeletonBlock({ width, height, style }: { width: number | string; height: number; style?: any }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, opacity: anim },
        style,
      ]}
    />
  );
}

// ── Mini SVG bar chart (web-compatible pure RN) ───────────────────────────────

function BarChart({ data, color, height = 80 }: { data: { label: string; value: number }[]; color: string; height?: number }) {
  const { width: winW } = useWindowDimensions();
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barW = Math.max(8, Math.floor((winW * 0.5) / Math.max(data.length, 1)) - 6);

  if (data.length === 0) {
    return (
      <View style={[s.emptyChart, { height }]}>
        <BarChart3 size={28} color={Colors.textMuted} strokeWidth={1.5} />
        <Text style={s.emptyChartText}>No data yet</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: height + 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingBottom: 24, paddingHorizontal: 2 }}>
        {data.map((d, i) => {
          const barH = Math.max(4, Math.round((d.value / maxVal) * height));
          return (
            <View key={i} style={{ alignItems: 'center', gap: 3 }}>
              <Text style={s.barValue}>{d.value > 999 ? (d.value / 1000).toFixed(1) + 'k' : d.value}</Text>
              <View
                style={{
                  width: barW,
                  height: barH,
                  backgroundColor: color,
                  borderRadius: 3,
                  opacity: 0.85,
                }}
              />
              <Text style={s.barLabel} numberOfLines={1}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

// ── Line Sparkline ────────────────────────────────────────────────────────────

function LineSparkline({ data, color, height = 48 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({ x: i / (data.length - 1), y: 1 - (v - min) / range }));
  const w = 120;
  const h = height;
  const pathParts = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x * w).toFixed(1)} ${(p.y * h).toFixed(1)}`);
  const path = pathParts.join(' ');

  return (
    // @ts-ignore — SVG renders on web, silently skips on native
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      {/* @ts-ignore */}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, color, change, sparkline, hint,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  change?: number;
  sparkline?: number[];
  hint?: string;
}) {
  return (
    <View style={[s.statCard, { borderColor: color + '30' }]}>
      <View style={s.statCardTop}>
        <View style={[s.statIcon, { backgroundColor: color + '18' }]}>{icon}</View>
        {change !== undefined && (
          <View style={[s.changePill, { backgroundColor: (change >= 0 ? Colors.success : Colors.error) + '18' }]}>
            {change >= 0
              ? <TrendingUp size={10} color={Colors.success} strokeWidth={2} />
              : <TrendingDown size={10} color={Colors.error} strokeWidth={2} />
            }
            <Text style={[s.changeText, { color: change >= 0 ? Colors.success : Colors.error }]}>
              {Math.abs(change)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {hint && <Text style={s.statHint}>{hint}</Text>}
      {sparkline && sparkline.length > 1 && (
        <View style={{ marginTop: 6, opacity: 0.7 }}>
          <LineSparkline data={sparkline} color={color} height={32} />
        </View>
      )}
    </View>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        {icon}
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function fetchAnalytics(period: Period) {
  const db = adminSupabase();
  const interval = periodToInterval(period);
  const since = interval
    ? new Date(Date.now() - parseDays(period) * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const prevSince = interval
    ? new Date(Date.now() - 2 * parseDays(period) * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const prevUntil = since;

  // Build order queries
  let currOrdersQ = db.from('orders').select('id, total, status, created_at');
  let prevOrdersQ = db.from('orders').select('id, total, status, created_at');
  if (since) {
    currOrdersQ = currOrdersQ.gte('created_at', since);
    if (prevSince && prevUntil) {
      prevOrdersQ = prevOrdersQ.gte('created_at', prevSince).lt('created_at', prevUntil);
    }
  }

  const [currOrdersRes, prevOrdersRes, customersRes, topProductsRes, tryOnRes, abandonedRes, pageViewsRes] =
    await Promise.all([
      currOrdersQ.order('created_at', { ascending: true }),
      since ? prevOrdersQ : Promise.resolve({ data: [], error: null }),
      db.from('customers').select('id, created_at', { count: 'exact' }),
      (() => {
        let q = db.from('order_items')
          .select('product_id, product_name, quantity, unit_price, created_at');
        // join via orders created_at filter not directly possible — fetch all then filter
        return q.order('created_at', { ascending: false }).limit(500);
      })(),
      (() => {
        let q = db.from('tryon_events').select('shade_name, shade_hex, category, created_at');
        if (since) q = q.gte('created_at', since);
        return q.order('created_at', { ascending: false }).limit(500);
      })(),
      (() => {
        let q = db.from('abandoned_carts').select('id, session_id, total_value, item_count, created_at, items');
        if (since) q = q.gte('created_at', since);
        return q.order('created_at', { ascending: false }).limit(100);
      })(),
      (() => {
        let q = db.from('page_views').select('page, product_id, created_at');
        if (since) q = q.gte('created_at', since);
        return q.order('created_at', { ascending: false }).limit(2000);
      })(),
    ]);

  const currOrders = (currOrdersRes.data ?? []) as any[];
  const prevOrders = (prevOrdersRes.data ?? []) as any[];
  const customers = (customersRes.data ?? []) as any[];
  const orderItems = (topProductsRes.data ?? []) as any[];
  const tryOnEvents = (tryOnRes.data ?? []) as any[];
  const abandonedCarts = (abandonedRes.data ?? []) as any[];
  const pageViews = (pageViewsRes.data ?? []) as any[];

  // Filter order items by period if needed
  const filteredItems = since
    ? orderItems.filter((i: any) => i.created_at >= since)
    : orderItems;

  // Overview stats
  const nonCancelledCurr = currOrders.filter((o: any) => o.status !== 'cancelled');
  const nonCancelledPrev = prevOrders.filter((o: any) => o.status !== 'cancelled');
  const totalRevenue = nonCancelledCurr.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const prevRevenue = nonCancelledPrev.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
  const totalOrders = currOrders.length;
  const avgOrderValue = nonCancelledCurr.length > 0 ? totalRevenue / nonCancelledCurr.length : 0;
  const visitors = pageViews.length > 0
    ? new Set(pageViews.map((v: any) => v.session_id || v.created_at.substring(0, 10))).size
    : 0;
  const conversionRate = visitors > 0 ? Math.round((totalOrders / visitors) * 1000) / 10 : 0;

  // Days chart
  const dayMap: Record<string, { orders: number; revenue: number }> = {};
  for (const o of currOrders) {
    const day = o.created_at.substring(0, 10);
    if (!dayMap[day]) dayMap[day] = { orders: 0, revenue: 0 };
    dayMap[day].orders += 1;
    if (o.status !== 'cancelled') dayMap[day].revenue += Number(o.total || 0);
  }
  const dayPoints: DayPoint[] = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({
      label: day.substring(5), // MM-DD
      orders: v.orders,
      revenue: Math.round(v.revenue),
    }));

  // Top products
  const productMap: Record<string, { product_id: string; product_name: string; units: number; revenue: number }> = {};
  for (const item of filteredItems) {
    const key = item.product_id || item.product_name;
    if (!productMap[key]) {
      productMap[key] = { product_id: item.product_id, product_name: item.product_name, units: 0, revenue: 0 };
    }
    productMap[key].units += Number(item.quantity || 0);
    productMap[key].revenue += Number(item.unit_price || 0) * Number(item.quantity || 0);
  }
  const topProducts: TopProduct[] = Object.values(productMap)
    .sort((a, b) => b.units - a.units)
    .slice(0, 10)
    .map(p => ({ product_id: p.product_id, product_name: p.product_name, units_sold: p.units, revenue: p.revenue }));

  // Top shades
  const shadeMap: Record<string, { shade_name: string; shade_hex: string; category: string; count: number }> = {};
  for (const e of tryOnEvents) {
    const key = `${e.shade_name}:${e.shade_hex}`;
    if (!shadeMap[key]) shadeMap[key] = { shade_name: e.shade_name, shade_hex: e.shade_hex, category: e.category, count: 0 };
    shadeMap[key].count += 1;
  }
  const topShades: TopShade[] = Object.values(shadeMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Most viewed products
  const viewMap: Record<string, { product_name: string; product_id: string; views: number }> = {};
  for (const pv of pageViews) {
    if (pv.page === 'product_detail' && pv.product_id) {
      if (!viewMap[pv.product_id]) viewMap[pv.product_id] = { product_name: 'Product', product_id: pv.product_id, views: 0 };
      viewMap[pv.product_id].views += 1;
    }
  }
  const mostViewed: MostViewed[] = Object.values(viewMap)
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const stats: OverviewStats = {
    totalRevenue,
    totalOrders,
    totalCustomers: customers.length,
    totalVisitors: visitors,
    abandonedCarts: abandonedCarts.length,
    tryOnUsage: tryOnEvents.length,
    conversionRate,
    avgOrderValue,
    revenueChange: pctChange(totalRevenue, prevRevenue),
    ordersChange: pctChange(totalOrders, prevOrders.length),
  };

  // Loyalty analytics via RPC
  const loyaltyRes = await db.rpc('get_loyalty_analytics', { p_since: since ?? undefined });
  const loyaltyData: LoyaltyAnalytics = loyaltyRes.data ?? {
    total_points_issued: 0,
    total_points_redeemed: 0,
    total_members: 0,
    active_members_90d: 0,
    avg_balance: 0,
    redemption_rate_pct: 0,
    repeat_purchase_rate_pct: 0,
    tier_distribution: {},
    top_earners: [],
  };

  return { stats, dayPoints, topProducts, topShades, abandonedCarts, mostViewed, loyalty: loyaltyData };
}

function parseDays(p: Period): number {
  if (p === 'today') return 1;
  if (p === '7d') return 7;
  if (p === '30d') return 30;
  return 365;
}

// ── Main analytics content ────────────────────────────────────────────────────

function AnalyticsContent() {
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [period, setPeriod] = useState<Period>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [dayPoints, setDayPoints] = useState<DayPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topShades, setTopShades] = useState<TopShade[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([]);
  const [mostViewed, setMostViewed] = useState<MostViewed[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyAnalytics | null>(null);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAnalytics(p);
      setStats(result.stats);
      setDayPoints(result.dayPoints);
      setTopProducts(result.topProducts);
      setTopShades(result.topShades);
      setAbandonedCarts(result.abandonedCarts as AbandonedCart[]);
      setMostViewed(result.mostViewed);
      setLoyalty(result.loyalty);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period]);

  // period button
  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: 'all', label: 'All Time' },
  ];

  const revenueSpark = dayPoints.map(d => d.revenue);
  const ordersSpark = dayPoints.map(d => d.orders);

  const cols = isWide ? 3 : 2;
  const cardFlex = 1 / cols;

  return (
    <View style={s.container}>
      {/* Period filter */}
      <View style={s.filterRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[s.filterBtn, period === p.key && s.filterBtnActive]}
            onPress={() => setPeriod(p.key)}
            activeOpacity={0.75}
          >
            <Text style={[s.filterBtnText, period === p.key && s.filterBtnTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.refreshBtn} onPress={() => load(period)} activeOpacity={0.7}>
          <RefreshCw size={14} color={Colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={s.errorBox}>
          <AlertCircle size={18} color={Colors.error} strokeWidth={2} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(period)} activeOpacity={0.8}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Overview cards ─────────────────────────────────────────────── */}
      {loading ? (
        <View>
          <View style={[s.cardsGrid, { flexWrap: 'wrap' }]}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <View key={i} style={[s.statCard, { flex: undefined, width: isWide ? '31%' : '48%', marginBottom: Spacing.sm }]}>
                <SkeletonBlock width={38} height={38} style={{ marginBottom: 8 }} />
                <SkeletonBlock width="60%" height={22} style={{ marginBottom: 6 }} />
                <SkeletonBlock width="80%" height={12} />
              </View>
            ))}
          </View>
          <View style={s.section}>
            <SkeletonBlock width="40%" height={16} style={{ marginBottom: 16 }} />
            <SkeletonBlock width="100%" height={100} />
          </View>
        </View>
      ) : stats ? (
        <>
          <View style={[s.cardsGrid, { flexWrap: 'wrap' }]}>
            <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
              <StatCard
                label="Total Revenue"
                value={formatPrice(stats.totalRevenue, language)}
                icon={<TrendingUp size={20} color={Colors.neonBlue} strokeWidth={2} />}
                color={Colors.neonBlue}
                change={stats.revenueChange}
                sparkline={revenueSpark}
              />
            </View>
            <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
              <StatCard
                label="Orders"
                value={stats.totalOrders.toLocaleString()}
                icon={<ShoppingCart size={20} color={Colors.success} strokeWidth={2} />}
                color={Colors.success}
                change={stats.ordersChange}
                sparkline={ordersSpark}
              />
            </View>
            <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
              <StatCard
                label="Avg. Order Value"
                value={formatPrice(stats.avgOrderValue, language)}
                icon={<ShoppingBag size={20} color={Colors.gold} strokeWidth={2} />}
                color={Colors.gold}
              />
            </View>
            <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
              <StatCard
                label="Visitors"
                value={stats.totalVisitors.toLocaleString()}
                icon={<Users size={20} color="#60CDFF" strokeWidth={2} />}
                color="#60CDFF"
                hint="Unique sessions"
              />
            </View>
            <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
              <StatCard
                label="Conversion Rate"
                value={`${stats.conversionRate}%`}
                icon={<MousePointerClick size={20} color="#A78BFA" strokeWidth={2} />}
                color="#A78BFA"
                hint="Orders / visitors"
              />
            </View>
            <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
              <StatCard
                label="Abandoned Carts"
                value={stats.abandonedCarts.toLocaleString()}
                icon={<ShoppingCart size={20} color={Colors.warning} strokeWidth={2} />}
                color={Colors.warning}
              />
            </View>
            <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
              <StatCard
                label="AI Try-On Usage"
                value={stats.tryOnUsage.toLocaleString()}
                icon={<Sparkles size={20} color={Colors.neonBlue} strokeWidth={2} />}
                color={Colors.neonBlue}
                hint="Virtual try-on events"
              />
            </View>
            <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
              <StatCard
                label="Customers"
                value={stats.totalCustomers.toLocaleString()}
                icon={<Users size={20} color={Colors.success} strokeWidth={2} />}
                color={Colors.success}
              />
            </View>
          </View>

          {/* ── Sales over time ───────────────────────────────────────── */}
          <Section
            title="Revenue Over Time"
            icon={<TrendingUp size={16} color={Colors.neonBlue} strokeWidth={2} />}
          >
            {dayPoints.length === 0 ? (
              <EmptyState label="No order data for this period" />
            ) : (
              <BarChart
                data={dayPoints.map(d => ({ label: d.label, value: d.revenue }))}
                color={Colors.neonBlue}
                height={100}
              />
            )}
          </Section>

          {/* ── Orders over time ──────────────────────────────────────── */}
          <Section
            title="Orders Over Time"
            icon={<ShoppingCart size={16} color={Colors.success} strokeWidth={2} />}
          >
            {dayPoints.length === 0 ? (
              <EmptyState label="No order data for this period" />
            ) : (
              <BarChart
                data={dayPoints.map(d => ({ label: d.label, value: d.orders }))}
                color={Colors.success}
                height={80}
              />
            )}
          </Section>

          {/* ── Top selling products table ────────────────────────────── */}
          <Section
            title="Top Selling Products"
            icon={<Package size={16} color={Colors.gold} strokeWidth={2} />}
          >
            {topProducts.length === 0 ? (
              <EmptyState label="No sales data yet" />
            ) : (
              <View>
                <TableHeader cols={['Product', 'Units Sold', 'Revenue']} />
                {topProducts.map((p, i) => (
                  <TableRow
                    key={p.product_id || i}
                    cols={[
                      { value: p.product_name, flex: 2, accent: false },
                      { value: p.units_sold.toString(), flex: 1, accent: false },
                      { value: formatPrice(p.revenue, language), flex: 1, accent: true },
                    ]}
                    even={i % 2 === 0}
                  />
                ))}
              </View>
            )}
          </Section>

          {/* ── AI Try-On shades ──────────────────────────────────────── */}
          <Section
            title="Most Tried AI Shades"
            icon={<Sparkles size={16} color="#A78BFA" strokeWidth={2} />}
          >
            {topShades.length === 0 ? (
              <EmptyState label="No try-on events yet — starts tracking when customers use Virtual Try-On" />
            ) : (
              <View>
                <TableHeader cols={['Shade', 'Category', 'Tries']} />
                {topShades.map((sh, i) => (
                  <View
                    key={i}
                    style={[s.tableRow, i % 2 === 0 && s.tableRowEven]}
                  >
                    <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[s.shadeCircle, { backgroundColor: sh.shade_hex || '#999' }]} />
                      <Text style={s.tableCell} numberOfLines={1}>{sh.shade_name || '—'}</Text>
                    </View>
                    <Text style={[s.tableCell, { flex: 1 }]} numberOfLines={1}>{sh.category}</Text>
                    <Text style={[s.tableCell, { flex: 1, color: '#A78BFA', fontWeight: '800' }]}>{sh.count}</Text>
                  </View>
                ))}
              </View>
            )}
          </Section>

          {/* ── Most viewed products ──────────────────────────────────── */}
          <Section
            title="Most Viewed Products"
            icon={<Eye size={16} color="#60CDFF" strokeWidth={2} />}
          >
            {mostViewed.length === 0 ? (
              <EmptyState label="No product views tracked yet — tracking begins from now" />
            ) : (
              <View>
                <TableHeader cols={['Product', 'Views']} />
                {mostViewed.map((p, i) => (
                  <TableRow
                    key={p.product_id || i}
                    cols={[
                      { value: p.product_name, flex: 3, accent: false },
                      { value: p.views.toString(), flex: 1, accent: true },
                    ]}
                    even={i % 2 === 0}
                  />
                ))}
              </View>
            )}
          </Section>

          {/* ── Abandoned carts ───────────────────────────────────────── */}
          <Section
            title="Abandoned Carts"
            icon={<ShoppingCart size={16} color={Colors.warning} strokeWidth={2} />}
          >
            {abandonedCarts.length === 0 ? (
              <EmptyState label="No abandoned cart data yet — tracking begins from now" />
            ) : (
              <View>
                <TableHeader cols={['Session', 'Items', 'Value', 'Date']} />
                {abandonedCarts.map((c, i) => (
                  <TableRow
                    key={c.id}
                    cols={[
                      { value: c.session_id.substring(0, 12) + '…', flex: 2, accent: false },
                      { value: c.item_count.toString(), flex: 1, accent: false },
                      { value: formatPrice(c.total_value, language), flex: 1, accent: true },
                      { value: new Date(c.created_at).toLocaleDateString(), flex: 1, accent: false },
                    ]}
                    even={i % 2 === 0}
                  />
                ))}
              </View>
            )}
          </Section>

          {/* ── Loyalty Analytics ─────────────────────────────────────── */}
          {loyalty && <LoyaltyAnalyticsSection loyalty={loyalty} isWide={isWide} />}
        </>
      ) : null}
    </View>
  );
}

// ── Loyalty Analytics Section ─────────────────────────────────────────────────

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'] as const;

function LoyaltyAnalyticsSection({ loyalty, isWide }: { loyalty: LoyaltyAnalytics; isWide: boolean }) {
  const { language } = useLanguage();

  const tierDist = TIER_ORDER.map(tier => ({
    tier,
    count: loyalty.tier_distribution[tier] ?? 0,
    color: TIER_COLORS[tier],
  }));

  const totalTierMembers = tierDist.reduce((s, t) => s + t.count, 0) || 1;

  return (
    <>
      {/* ── Loyalty KPI cards ─────────────────────────────────────────── */}
      <Section
        title="Loyalty Program"
        icon={<Coins size={16} color={Colors.gold} strokeWidth={2} />}
      >
        <View style={[s.cardsGrid, { flexWrap: 'wrap' }]}>
          <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
            <StatCard
              label="Points Issued"
              value={loyalty.total_points_issued.toLocaleString()}
              icon={<Coins size={20} color={Colors.gold} strokeWidth={2} />}
              color={Colors.gold}
              hint="Confirmed earn transactions"
            />
          </View>
          <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
            <StatCard
              label="Points Redeemed"
              value={loyalty.total_points_redeemed.toLocaleString()}
              icon={<Wallet size={20} color={Colors.neonBlue} strokeWidth={2} />}
              color={Colors.neonBlue}
              hint="Applied at checkout"
            />
          </View>
          <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
            <StatCard
              label="Redemption Rate"
              value={`${loyalty.redemption_rate_pct}%`}
              icon={<TrendingUp size={20} color={Colors.success} strokeWidth={2} />}
              color={Colors.success}
              hint="Redeemed / issued"
            />
          </View>
          <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
            <StatCard
              label="Enrolled Members"
              value={loyalty.total_members.toLocaleString()}
              icon={<Users size={20} color="#60CDFF" strokeWidth={2} />}
              color="#60CDFF"
              hint={`${loyalty.active_members_90d} active (90d)`}
            />
          </View>
          <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
            <StatCard
              label="Avg. Balance"
              value={Math.round(loyalty.avg_balance).toLocaleString() + ' pts'}
              icon={<Wallet size={20} color={Colors.gold} strokeWidth={2} />}
              color={Colors.gold}
            />
          </View>
          <View style={[s.statCardWrapper, { width: isWide ? '31%' : '48%' }]}>
            <StatCard
              label="Repeat Purchase Rate"
              value={`${loyalty.repeat_purchase_rate_pct}%`}
              icon={<Repeat2 size={20} color={Colors.success} strokeWidth={2} />}
              color={Colors.success}
              hint="Customers with 2+ delivered orders"
            />
          </View>
        </View>
      </Section>

      {/* ── Tier distribution ─────────────────────────────────────────── */}
      <Section
        title="Tier Distribution"
        icon={<Crown size={16} color={Colors.gold} strokeWidth={2} />}
      >
        <View style={loyaltyStyles.tierGrid}>
          {tierDist.map(({ tier, count, color }) => {
            const pct = Math.round((count / totalTierMembers) * 100);
            return (
              <View key={tier} style={[loyaltyStyles.tierCard, { borderColor: color + '40' }]}>
                <View style={[loyaltyStyles.tierDot, { backgroundColor: color + '25', borderColor: color + '60' }]}>
                  <Crown size={14} color={color} strokeWidth={2} />
                </View>
                <Text style={[loyaltyStyles.tierName, { color }]}>
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </Text>
                <Text style={loyaltyStyles.tierCount}>{count.toLocaleString()}</Text>
                <Text style={loyaltyStyles.tierPct}>{pct}%</Text>
                <View style={loyaltyStyles.tierBarTrack}>
                  <View style={[loyaltyStyles.tierBarFill, { width: `${pct}%` as any, backgroundColor: color }]} />
                </View>
              </View>
            );
          })}
        </View>
      </Section>

      {/* ── Top loyal customers ───────────────────────────────────────── */}
      <Section
        title="Top Loyal Customers"
        icon={<Crown size={16} color={Colors.gold} strokeWidth={2} />}
      >
        {loyalty.top_earners.length === 0 ? (
          <EmptyState label="No loyalty members yet" />
        ) : (
          <View>
            <TableHeader cols={['Customer', 'Balance', 'Lifetime', 'Tier']} />
            {loyalty.top_earners.map((e, i) => {
              const tierColor = TIER_COLORS[e.tier as keyof typeof TIER_COLORS] ?? Colors.gold;
              return (
                <View key={e.user_id} style={[s.tableRow, i % 2 === 0 && s.tableRowEven]}>
                  <Text style={[s.tableCell, { flex: 2 }]} numberOfLines={1}>
                    {e.email ?? e.user_id.substring(0, 12) + '…'}
                  </Text>
                  <Text style={[s.tableCell, { flex: 1, color: Colors.gold, fontWeight: '800' }]}>
                    {e.total_points.toLocaleString()}
                  </Text>
                  <Text style={[s.tableCell, { flex: 1, color: Colors.neonBlue, fontWeight: '700' }]}>
                    {e.lifetime_points.toLocaleString()}
                  </Text>
                  <Text style={[s.tableCell, { flex: 1, color: tierColor, fontWeight: '800' }]}>
                    {e.tier.charAt(0).toUpperCase() + e.tier.slice(1)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Section>
    </>
  );
}

const loyaltyStyles = StyleSheet.create({
  tierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tierCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    alignItems: 'center',
  },
  tierDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  tierName: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tierCount: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '900',
  },
  tierPct: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  tierBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  tierBarFill: {
    height: 4,
    borderRadius: 2,
  },
});

// ── Table helpers ─────────────────────────────────────────────────────────────

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <View style={s.tableHeader}>
      {cols.map((c, i) => (
        <Text key={i} style={[s.tableHeaderCell, i === 0 && { flex: 2 }, i > 0 && { flex: 1 }]}>
          {c.toUpperCase()}
        </Text>
      ))}
    </View>
  );
}

function TableRow({ cols, even }: { cols: { value: string; flex: number; accent: boolean }[]; even: boolean }) {
  return (
    <View style={[s.tableRow, even && s.tableRowEven]}>
      {cols.map((c, i) => (
        <Text
          key={i}
          style={[
            s.tableCell,
            { flex: c.flex },
            c.accent && { color: Colors.neonBlue, fontWeight: '800' },
          ]}
          numberOfLines={1}
        >
          {c.value}
        </Text>
      ))}
    </View>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <View style={s.emptyState}>
      <BarChart3 size={32} color={Colors.textMuted} strokeWidth={1.5} />
      <Text style={s.emptyStateText}>{label}</Text>
    </View>
  );
}

// ── Screen wrappers ───────────────────────────────────────────────────────────

function AnalyticsScreen() {
  const { isMobile } = useAdminLayout();
  if (isMobile) {
    return (
      <AdminMobileDashboard title="Analytics">
        <AnalyticsContent />
      </AdminMobileDashboard>
    );
  }
  return (
    <AdminWebDashboard title="Analytics" subtitle="Sales, traffic & engagement metrics">
      <AnalyticsContent />
    </AdminWebDashboard>
  );
}

export default function AnalyticsScreenGuarded() {
  return (
    <AdminGuard permission="view_dashboard">
      <AnalyticsScreen />
    </AdminGuard>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlueBorder,
  },
  filterBtnText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  filterBtnTextActive: {
    color: Colors.neonBlue,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.error + '18',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error + '40',
  },
  errorText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    flex: 1,
  },
  retryText: {
    color: Colors.neonBlue,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  cardsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statCardWrapper: {
    marginBottom: Spacing.sm,
  },
  statCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
  },
  statCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  changeText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
  },
  statHint: {
    color: Colors.textMuted,
    fontSize: 9,
    marginTop: 2,
    opacity: 0.7,
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
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  emptyChart: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
  },
  emptyChartText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  barValue: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  barLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    maxWidth: 36,
    textAlign: 'center',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 2,
  },
  tableHeaderCell: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  tableRowEven: {
    backgroundColor: Colors.backgroundSecondary,
  },
  tableCell: {
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    flex: 1,
  },
  shadeCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyStateText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
});
