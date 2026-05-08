import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase, adminSupabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'offer' | 'new_product' | 'custom';
export type OrderNotificationType =
  | 'order_placed'
  | 'order_confirmed'
  | 'order_preparing'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled';
export type AnyNotificationType = NotificationType | OrderNotificationType;

export type NotificationChannel = 'app' | 'push' | 'whatsapp' | 'email' | 'multiple';
export type NotificationTarget = 'all' | 'selected';
export type NotificationStatus = 'draft' | 'sent' | 'failed';
export type RecipientStatus = 'pending' | 'sent' | 'failed';

// Broadcast notifications (admin-sent to all users)
export type AppNotification = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  created_at: string;
  sent_at: string | null;
  isRead?: boolean;
  // discriminator
  source: 'broadcast';
};

// Per-user order notifications (from DB trigger)
export type OrderNotification = {
  id: string;
  order_id: string;
  title: string;
  body: string;
  type: OrderNotificationType;
  is_read: boolean;
  created_at: string;
  // discriminator
  source: 'order';
};

// Union for rendering in the inbox
export type InboxItem = AppNotification | OrderNotification;

export type CustomerRow = {
  id: string;
  auth_user_id: string | null;
  name: string;
  phone: string;
  email: string;
  whatsapp_opt_in: boolean;
  email_opt_in: boolean;
  app_opt_in: boolean;
  created_at: string;
};

export type AdminNotification = AppNotification & {
  recipient_count?: number;
  sent_count?: number;
  failed_count?: number;
};

// ─── Placeholder send functions ───────────────────────────────────────────────

export async function sendEmail(to: string, subject: string, message: string): Promise<void> {
  console.log('[sendEmail] TO:', to, 'SUBJECT:', subject, 'MESSAGE:', message.slice(0, 80));
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  console.log('[sendWhatsApp] TO:', phone, 'MESSAGE:', message.slice(0, 80));
}

// ─── Push token registration (Expo Notifications — web-safe) ─────────────────

export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return; // Web push requires service workers — not wired here
  try {
    // Dynamically import so web bundle doesn't break
    const Notifications = await import('expo-notifications');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await supabase.from('user_push_tokens').upsert(
      { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' }
    );
  } catch (e) {
    console.warn('[Push] registerPushToken failed:', e);
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

type NotificationContextType = {
  // Combined inbox (broadcast + order notifications)
  inboxItems: InboxItem[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (item: InboxItem) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;

  // Legacy — broadcast-only notifications (used by existing notifications.tsx)
  notifications: AppNotification[];

  // Customer profile
  customerRow: CustomerRow | null;
  savingPrefs: boolean;
  upsertCustomer: (data: Partial<CustomerRow>) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [broadcastNotifs, setBroadcastNotifs] = useState<AppNotification[]>([]);
  const [orderNotifs, setOrderNotifs] = useState<OrderNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [customerRow, setCustomerRow] = useState<CustomerRow | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Supabase realtime channel refs so we can clean them up
  const orderRealtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Load broadcast notifications ──────────────────────────────────────────
  const loadBroadcast = useCallback(async () => {
    try {
      const { data: notifs } = await supabase
        .from('notifications')
        .select('id, title, message, type, channel, status, created_at, sent_at')
        .in('channel', ['app', 'multiple'])
        .eq('status', 'sent')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!notifs) return;

      let reads = new Set<string>();
      if (user?.id) {
        const { data: readRows } = await supabase
          .from('notification_reads')
          .select('notification_id')
          .eq('auth_user_id', user.id);
        reads = new Set((readRows ?? []).map((r: any) => r.notification_id));
        setReadIds(reads);
      }

      setBroadcastNotifs(
        notifs.map((n: any) => ({ ...n, isRead: reads.has(n.id), source: 'broadcast' as const }))
      );
    } catch (e) {
      console.error('[NotificationContext] loadBroadcast error:', e);
    }
  }, [user?.id]);

  // ── Load order notifications ──────────────────────────────────────────────
  const loadOrderNotifs = useCallback(async () => {
    if (!user?.id) { setOrderNotifs([]); return; }
    try {
      const { data } = await supabase
        .from('order_notifications')
        .select('id, order_id, title, body, type, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setOrderNotifs(
        (data ?? []).map((n: any) => ({ ...n, source: 'order' as const }))
      );
    } catch (e) {
      console.error('[NotificationContext] loadOrderNotifs error:', e);
    }
  }, [user?.id]);

  const loadCustomer = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    setCustomerRow(data ?? null);
  }, [user?.id]);

  // ── Initial load ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadBroadcast(), loadOrderNotifs(), loadCustomer()]);
    setLoading(false);
  }, [loadBroadcast, loadOrderNotifs, loadCustomer]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Register push token once user logs in ─────────────────────────────────
  useEffect(() => {
    if (user?.id) {
      registerPushToken(user.id).catch(() => {});
    }
  }, [user?.id]);

  // ── Realtime: listen for new order_notifications for this user ────────────
  useEffect(() => {
    if (!user?.id) {
      orderRealtimeRef.current?.unsubscribe();
      orderRealtimeRef.current = null;
      return;
    }

    const channel = supabase
      .channel(`order_notifs:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          setOrderNotifs((prev) => [
            { ...row, source: 'order' as const },
            ...prev,
          ]);
        }
      )
      .subscribe();

    orderRealtimeRef.current = channel;
    return () => {
      channel.unsubscribe();
      orderRealtimeRef.current = null;
    };
  }, [user?.id]);

  // ── Mark read ─────────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (item: InboxItem) => {
    if (!user?.id) return;

    if (item.source === 'order') {
      if (item.is_read) return;
      setOrderNotifs((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      await supabase
        .from('order_notifications')
        .update({ is_read: true })
        .eq('id', item.id)
        .eq('user_id', user.id);
    } else {
      if (readIds.has(item.id)) return;
      const newIds = new Set([...readIds, item.id]);
      setReadIds(newIds);
      setBroadcastNotifs((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      await supabase
        .from('notification_reads')
        .upsert(
          { notification_id: item.id, auth_user_id: user.id },
          { onConflict: 'notification_id,auth_user_id' }
        );
    }
  }, [user?.id, readIds]);

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;

    // Mark all order notifications
    const unreadOrderIds = orderNotifs.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadOrderIds.length > 0) {
      setOrderNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      await supabase
        .from('order_notifications')
        .update({ is_read: true })
        .in('id', unreadOrderIds)
        .eq('user_id', user.id);
    }

    // Mark all broadcast notifications
    const unreadBroadcast = broadcastNotifs.filter((n) => !n.isRead);
    if (unreadBroadcast.length > 0) {
      const newIds = new Set([...readIds, ...unreadBroadcast.map((n) => n.id)]);
      setReadIds(newIds);
      setBroadcastNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
      await supabase.from('notification_reads').upsert(
        unreadBroadcast.map((n) => ({ notification_id: n.id, auth_user_id: user.id })),
        { onConflict: 'notification_id,auth_user_id' }
      );
    }
  }, [user?.id, orderNotifs, broadcastNotifs, readIds]);

  const upsertCustomer = useCallback(async (data: Partial<CustomerRow>) => {
    if (!user?.id) return;
    setSavingPrefs(true);
    try {
      const payload = {
        auth_user_id: user.id,
        email: data.email ?? user.email ?? '',
        name: data.name ?? `${(user as any).firstName ?? ''} ${(user as any).lastName ?? ''}`.trim(),
        phone: data.phone ?? '',
        whatsapp_opt_in: data.whatsapp_opt_in ?? false,
        email_opt_in: data.email_opt_in ?? false,
        app_opt_in: data.app_opt_in ?? true,
        updated_at: new Date().toISOString(),
        ...data,
      };
      const { data: row, error } = await supabase
        .from('customers')
        .upsert(payload, { onConflict: 'auth_user_id' })
        .select()
        .maybeSingle();
      if (!error && row) setCustomerRow(row);
    } catch (e) {
      console.error('[NotificationContext] upsertCustomer error:', e);
    } finally {
      setSavingPrefs(false);
    }
  }, [user]);

  // ── Combine + sort inbox ──────────────────────────────────────────────────
  const inboxItems: InboxItem[] = React.useMemo(() => {
    const all: InboxItem[] = [...broadcastNotifs, ...orderNotifs];
    return all.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [broadcastNotifs, orderNotifs]);

  const unreadCount = React.useMemo(
    () =>
      broadcastNotifs.filter((n) => !n.isRead).length +
      orderNotifs.filter((n) => !n.is_read).length,
    [broadcastNotifs, orderNotifs]
  );

  return (
    <NotificationContext.Provider
      value={{
        inboxItems,
        unreadCount,
        loading,
        markAsRead,
        markAllRead,
        refresh: loadAll,
        notifications: broadcastNotifs,
        customerRow,
        savingPrefs,
        upsertCustomer,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

// ─── Admin send helper (called from admin pages) ──────────────────────────────

export async function adminSendNotification(opts: {
  title: string;
  message: string;
  type: NotificationType;
  channels: NotificationChannel[];
  target: NotificationTarget;
  selectedCustomerIds?: string[];
  manualContacts?: { phone?: string; email?: string }[];
}): Promise<{ success: boolean; error?: string; notificationId?: string }> {
  const db = adminSupabase();
  const channel: NotificationChannel = opts.channels.length === 1 ? opts.channels[0] : 'multiple';

  try {
    const { data: notif, error: notifErr } = await db
      .from('notifications')
      .insert({
        title: opts.title,
        message: opts.message,
        type: opts.type,
        channel,
        target: opts.target,
        status: 'draft',
      })
      .select()
      .maybeSingle();

    if (notifErr || !notif) return { success: false, error: notifErr?.message ?? 'Failed to create notification' };

    const notificationId: string = notif.id;

    let recipients: { auth_user_id?: string; customer_id?: string; phone: string; email: string }[] = [];

    if (opts.target === 'all') {
      const { data: customers } = await db
        .from('customers')
        .select('id, auth_user_id, phone, email, whatsapp_opt_in, email_opt_in, app_opt_in');
      recipients = (customers ?? []).map((c: any) => ({
        customer_id: c.id,
        auth_user_id: c.auth_user_id,
        phone: c.phone,
        email: c.email,
        _whatsapp_opt_in: c.whatsapp_opt_in,
        _email_opt_in: c.email_opt_in,
        _app_opt_in: c.app_opt_in,
      }));
    } else if (opts.target === 'selected' && opts.selectedCustomerIds?.length) {
      const { data: customers } = await db
        .from('customers')
        .select('id, auth_user_id, phone, email, whatsapp_opt_in, email_opt_in, app_opt_in')
        .in('id', opts.selectedCustomerIds);
      recipients = (customers ?? []).map((c: any) => ({
        customer_id: c.id,
        auth_user_id: c.auth_user_id,
        phone: c.phone,
        email: c.email,
        _whatsapp_opt_in: c.whatsapp_opt_in,
        _email_opt_in: c.email_opt_in,
        _app_opt_in: c.app_opt_in,
      }));
    }

    if (opts.manualContacts?.length) {
      for (const mc of opts.manualContacts) {
        if (mc.phone || mc.email) {
          recipients.push({ phone: mc.phone ?? '', email: mc.email ?? '', _whatsapp_opt_in: true, _email_opt_in: true, _app_opt_in: true } as any);
        }
      }
    }

    const recipientRows: any[] = [];
    for (const ch of opts.channels) {
      for (const r of recipients) {
        const rAny = r as any;
        if (ch === 'whatsapp' && !rAny._whatsapp_opt_in) continue;
        if (ch === 'email' && !rAny._email_opt_in) continue;
        if (ch === 'app' && !rAny._app_opt_in) continue;
        if (ch === 'push' && !rAny._app_opt_in) continue;
        recipientRows.push({
          notification_id: notificationId,
          customer_id: r.customer_id ?? null,
          auth_user_id: r.auth_user_id ?? null,
          phone: r.phone,
          email: r.email,
          channel: ch,
          status: 'pending',
        });
      }
    }

    if (recipientRows.length > 0) {
      await db.from('notification_recipients').insert(recipientRows);
    }

    let anyFailed = false;
    for (const row of recipientRows) {
      try {
        if (row.channel === 'email' && row.email) {
          await sendEmail(row.email, opts.title, opts.message);
        } else if (row.channel === 'whatsapp' && row.phone) {
          await sendWhatsAppMessage(row.phone, `*${opts.title}*\n\n${opts.message}`);
        }
        await db
          .from('notification_recipients')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('notification_id', notificationId)
          .eq('channel', row.channel)
          .eq('status', 'pending');
      } catch {
        anyFailed = true;
        await db
          .from('notification_recipients')
          .update({ status: 'failed' })
          .eq('notification_id', notificationId)
          .eq('channel', row.channel)
          .eq('status', 'pending');
      }
    }

    await db
      .from('notifications')
      .update({ status: anyFailed ? 'failed' : 'sent', sent_at: new Date().toISOString() })
      .eq('id', notificationId);

    return { success: true, notificationId };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' };
  }
}
