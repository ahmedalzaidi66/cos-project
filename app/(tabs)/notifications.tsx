import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Bell, CheckCheck, Tag, Sparkles, Package, Truck, CircleCheck as CheckCircle, Circle as XCircle, ClipboardList, ShoppingBag } from 'lucide-react-native';
import {
  useNotifications,
  InboxItem,
  NotificationType,
  OrderNotificationType,
} from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import AppHeader from '@/components/AppHeader';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { useAppColors } from '@/context/ThemeContext';

// ─── Type metadata ────────────────────────────────────────────────────────────

function getBroadcastMeta(t: any): Record<NotificationType, { icon: React.ComponentType<any>; color: string; label: string }> {
  return {
    offer:       { icon: Tag,      color: Colors.gold,          label: t.notifTypeOffer },
    new_product: { icon: Package,  color: Colors.neonBlue,      label: t.notifTypeNewProduct },
    custom:      { icon: Sparkles, color: Colors.textSecondary, label: t.notifTypeUpdate },
  };
}

function getOrderMeta(t: any): Record<OrderNotificationType, { icon: React.ComponentType<any>; color: string; label: string }> {
  return {
    order_placed:    { icon: ShoppingBag,   color: Colors.neonBlue, label: t.notifTypeOrderPlaced },
    order_confirmed: { icon: ClipboardList, color: '#4ADE80',       label: t.notifTypeConfirmed },
    order_preparing: { icon: Package,       color: Colors.warning,  label: t.notifTypePreparing },
    order_shipped:   { icon: Truck,         color: '#7C83FF',       label: t.notifTypeShipped },
    order_delivered: { icon: CheckCircle,   color: Colors.success,  label: t.notifTypeDelivered },
    order_cancelled: { icon: XCircle,       color: Colors.error,    label: t.notifTypeCancelled },
  };
}

function timeAgo(dateStr: string, t: any): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t.notifJustNow;
  if (mins < 60) return (t.notifMinAgo as string).replace('{{n}}', String(mins));
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return (t.notifHourAgo as string).replace('{{n}}', String(hrs));
  const days = Math.floor(hrs / 24);
  if (days < 7) return (t.notifDayAgo as string).replace('{{n}}', String(days));
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Inbox item renderer ──────────────────────────────────────────────────────

function NotificationItem({ item, onPress }: { item: InboxItem; onPress: (item: InboxItem) => void }) {
  const { t } = useLanguage();
  const C = useAppColors();
  const isOrder = item.source === 'order';
  const isUnread = isOrder ? !item.is_read : !item.isRead;

  const broadcastMeta = getBroadcastMeta(t);
  const orderMeta = getOrderMeta(t);

  let meta: { icon: React.ComponentType<any>; color: string; label: string };
  let title: string;
  let message: string;

  if (isOrder) {
    meta = orderMeta[item.type as OrderNotificationType] ?? orderMeta.order_placed;
    title = item.title;
    message = item.body;
  } else {
    meta = broadcastMeta[item.type as NotificationType] ?? broadcastMeta.custom;
    title = item.title;
    message = item.message;
  }

  const Icon = meta.icon;

  return (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: C.backgroundCard, borderColor: C.border }, isUnread && { backgroundColor: C.navy, borderColor: C.neonBlueBorder }]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      {isUnread && <View style={styles.unreadDot} />}
      <View style={[styles.iconWrap, { backgroundColor: meta.color + '20', borderColor: meta.color + '40' }]}>
        <Icon size={18} color={meta.color} strokeWidth={2} />
      </View>
      <View style={styles.itemBody}>
        <View style={styles.itemTopRow}>
          <Text style={[styles.itemTitle, isUnread && styles.itemTitleUnread]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.itemTime}>{timeAgo(item.created_at, t)}</Text>
        </View>
        <Text style={styles.itemMessage} numberOfLines={2}>{message}</Text>
        <View style={[styles.typeBadge, { borderColor: meta.color + '50' }]}>
          <Text style={[styles.typeBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EmptyInbox() {
  const { t } = useLanguage();
  const C = useAppColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconWrap, { backgroundColor: C.backgroundCard, borderColor: C.border }]}>
        <Bell size={40} color={C.textMuted} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>{t.notifAllCaughtUp}</Text>
      <Text style={[styles.emptySubtitle, { color: C.textMuted }]}>{t.notifEmptySubtitle}</Text>
    </View>
  );
}

function GuestView() {
  const { t } = useLanguage();
  const C = useAppColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIconWrap, { backgroundColor: C.backgroundCard, borderColor: C.border }]}>
        <Bell size={40} color={C.textMuted} strokeWidth={1.5} />
      </View>
      <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>{t.notifSignIn}</Text>
      <Text style={[styles.emptySubtitle, { color: C.textMuted }]}>{t.notifSignInSubtitle}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { inboxItems, unreadCount, loading, markAsRead, markAllRead, refresh } = useNotifications();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const C = useAppColors();

  const handlePress = useCallback((item: InboxItem) => {
    markAsRead(item);
  }, [markAsRead]);

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <AppHeader title={t.notifTitle} />

      {isAuthenticated && unreadCount > 0 && (
        <View style={[styles.topBar, { backgroundColor: C.backgroundSecondary, borderBottomColor: C.border }]}>
          <Text style={styles.unreadLabel}>{(t.notifUnread as string).replace('{{n}}', String(unreadCount))}</Text>
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn} activeOpacity={0.7}>
            <CheckCheck size={14} color={Colors.neonBlue} strokeWidth={2} />
            <Text style={styles.markAllText}>{t.notifMarkAllRead}</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && inboxItems.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.neonBlue} />
        </View>
      ) : !isAuthenticated ? (
        <GuestView />
      ) : (
        <FlatList
          data={inboxItems}
          keyExtractor={(item) => `${item.source}:${item.id}`}
          renderItem={({ item }) => <NotificationItem item={item} onPress={handlePress} />}
          contentContainerStyle={[styles.list, inboxItems.length === 0 && styles.listEmpty]}
          ListEmptyComponent={<EmptyInbox />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={Colors.neonBlue}
              colors={[Colors.neonBlue]}
            />
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  unreadLabel: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  markAllText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '700' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  listEmpty: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  itemUnread: {
    borderColor: Colors.neonBlueBorder,
    backgroundColor: '#200D18',
  },
  unreadDot: {
    position: 'absolute',
    top: Spacing.md,
    left: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.neonBlue,
    shadowColor: Colors.neonBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  itemBody: { flex: 1, gap: 4 },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  itemTitle: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  itemTitleUnread: { color: Colors.textPrimary, fontWeight: '700' },
  itemTime: { color: Colors.textMuted, fontSize: FontSize.xs, flexShrink: 0, marginTop: 1 },
  itemMessage: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 19 },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginTop: 2,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xxl,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: { color: Colors.textSecondary, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { color: Colors.textMuted, fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },
});
