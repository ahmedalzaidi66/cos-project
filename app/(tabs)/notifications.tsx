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
import { Bell, CheckCheck, Package, Tag, MessageCircle, Sparkles } from 'lucide-react-native';
import { useNotifications, AppNotification, NotificationType } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import AppHeader from '@/components/AppHeader';
import { Colors, Spacing, FontSize, Radius, Shadow } from '@/constants/theme';

const TYPE_META: Record<NotificationType, { icon: React.ComponentType<any>; color: string; label: string }> = {
  offer: { icon: Tag, color: Colors.gold, label: 'Offer' },
  new_product: { icon: Package, color: Colors.neonBlue, label: 'New Product' },
  custom: { icon: Sparkles, color: Colors.textSecondary, label: 'Update' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function NotificationItem({ item, onPress }: { item: AppNotification; onPress: (id: string) => void }) {
  const meta = TYPE_META[item.type] ?? TYPE_META.custom;
  const Icon = meta.icon;

  return (
    <TouchableOpacity
      style={[styles.item, !item.isRead && styles.itemUnread]}
      onPress={() => onPress(item.id)}
      activeOpacity={0.75}
    >
      {!item.isRead && <View style={styles.unreadDot} />}
      <View style={[styles.iconWrap, { backgroundColor: meta.color + '20', borderColor: meta.color + '40' }]}>
        <Icon size={18} color={meta.color} strokeWidth={2} />
      </View>
      <View style={styles.itemBody}>
        <View style={styles.itemTopRow}>
          <Text style={[styles.itemTitle, !item.isRead && styles.itemTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.itemTime}>{timeAgo(item.sent_at ?? item.created_at)}</Text>
        </View>
        <Text style={styles.itemMessage} numberOfLines={2}>{item.message}</Text>
        <View style={[styles.typeBadge, { borderColor: meta.color + '50' }]}>
          <Text style={[styles.typeBadgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EmptyInbox() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconWrap}>
        <Bell size={40} color={Colors.textMuted} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>All caught up</Text>
      <Text style={styles.emptySubtitle}>New offers and updates will appear here</Text>
    </View>
  );
}

function GuestView() {
  const { t } = useLanguage();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconWrap}>
        <Bell size={40} color={Colors.textMuted} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>Sign in to see notifications</Text>
      <Text style={styles.emptySubtitle}>Create an account to receive offers and updates</Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const { notifications, unreadCount, loading, markAsRead, markAllRead, refresh } = useNotifications();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const handlePress = useCallback((id: string) => {
    markAsRead(id);
  }, [markAsRead]);

  return (
    <View style={styles.container}>
      <AppHeader title="Notifications" />

      {isAuthenticated && unreadCount > 0 && (
        <View style={styles.topBar}>
          <Text style={styles.unreadLabel}>
            {unreadCount} unread
          </Text>
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn} activeOpacity={0.7}>
            <CheckCheck size={14} color={Colors.neonBlue} strokeWidth={2} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && notifications.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.neonBlue} />
        </View>
      ) : !isAuthenticated ? (
        <GuestView />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationItem item={item} onPress={handlePress} />}
          contentContainerStyle={[styles.list, notifications.length === 0 && styles.listEmpty]}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  unreadLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
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
  markAllText: {
    color: Colors.neonBlue,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  listEmpty: {
    flex: 1,
  },
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
  itemBody: {
    flex: 1,
    gap: 4,
  },
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
  itemTitleUnread: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  itemTime: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    flexShrink: 0,
    marginTop: 1,
  },
  itemMessage: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginTop: 2,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
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
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
});
