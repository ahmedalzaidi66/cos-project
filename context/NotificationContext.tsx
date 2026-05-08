import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase, adminSupabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'offer' | 'new_product' | 'custom';
export type NotificationChannel = 'app' | 'push' | 'whatsapp' | 'email' | 'multiple';
export type NotificationTarget = 'all' | 'selected';
export type NotificationStatus = 'draft' | 'sent' | 'failed';
export type RecipientStatus = 'pending' | 'sent' | 'failed';

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
};

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

// ─── Placeholder send functions (future API integration) ─────────────────────

export async function sendEmail(to: string, subject: string, message: string): Promise<void> {
  console.log('[sendEmail] TO:', to, 'SUBJECT:', subject, 'MESSAGE:', message.slice(0, 80));
  // TODO: wire up to email provider (SendGrid, Resend, etc.) via edge function
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  console.log('[sendWhatsApp] TO:', phone, 'MESSAGE:', message.slice(0, 80));
  // TODO: wire up to WhatsApp Business API via edge function
}

// ─── Context ──────────────────────────────────────────────────────────────────

type NotificationContextType = {
  // In-app inbox
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;

  // Customer profile
  customerRow: CustomerRow | null;
  savingPrefs: boolean;
  upsertCustomer: (data: Partial<CustomerRow>) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [customerRow, setCustomerRow] = useState<CustomerRow | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch sent app/multiple notifications
      const { data: notifs } = await supabase
        .from('notifications')
        .select('id, title, message, type, channel, status, created_at, sent_at')
        .in('channel', ['app', 'multiple'])
        .eq('status', 'sent')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!notifs) { setLoading(false); return; }

      // Fetch read state for this user
      let reads = new Set<string>();
      if (user?.id) {
        const { data: readRows } = await supabase
          .from('notification_reads')
          .select('notification_id')
          .eq('auth_user_id', user.id);
        reads = new Set((readRows ?? []).map((r: any) => r.notification_id));
      }

      setReadIds(reads);
      setNotifications(notifs.map((n: any) => ({ ...n, isRead: reads.has(n.id) })));
    } catch (e) {
      console.error('[NotificationContext] loadNotifications error:', e);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    loadNotifications();
    loadCustomer();
  }, [loadNotifications, loadCustomer]);

  const markAsRead = useCallback(async (id: string) => {
    if (!user?.id || readIds.has(id)) return;
    setReadIds(prev => new Set([...prev, id]));
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    await supabase
      .from('notification_reads')
      .upsert({ notification_id: id, auth_user_id: user.id }, { onConflict: 'notification_id,auth_user_id' });
  }, [user?.id, readIds]);

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;
    const newIds = new Set([...readIds, ...unread.map(n => n.id)]);
    setReadIds(newIds);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    await supabase.from('notification_reads').upsert(
      unread.map(n => ({ notification_id: n.id, auth_user_id: user.id })),
      { onConflict: 'notification_id,auth_user_id' }
    );
  }, [user?.id, notifications, readIds]);

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

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllRead,
      refresh: loadNotifications,
      customerRow,
      savingPrefs,
      upsertCustomer,
    }}>
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
    // 1. Create notification record
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

    // 2. Resolve recipients
    let recipients: { auth_user_id?: string; customer_id?: string; phone: string; email: string }[] = [];

    if (opts.target === 'all') {
      const { data: customers } = await db.from('customers').select('id, auth_user_id, phone, email, whatsapp_opt_in, email_opt_in, app_opt_in');
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

    // Add manual contacts
    if (opts.manualContacts?.length) {
      for (const mc of opts.manualContacts) {
        if (mc.phone || mc.email) {
          recipients.push({ phone: mc.phone ?? '', email: mc.email ?? '', _whatsapp_opt_in: true, _email_opt_in: true, _app_opt_in: true } as any);
        }
      }
    }

    // 3. Build recipient rows per active channel
    const recipientRows: any[] = [];
    for (const ch of opts.channels) {
      for (const r of recipients) {
        const rAny = r as any;
        // Respect opt-ins
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

    // 4. Execute sends per channel
    let anyFailed = false;
    for (const row of recipientRows) {
      try {
        if (row.channel === 'email' && row.email) {
          await sendEmail(row.email, opts.title, opts.message);
        } else if (row.channel === 'whatsapp' && row.phone) {
          await sendWhatsAppMessage(row.phone, `*${opts.title}*\n\n${opts.message}`);
        }
        // app/push: visible via notification inbox query
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

    // 5. Mark notification as sent
    await db
      .from('notifications')
      .update({ status: anyFailed ? 'failed' : 'sent', sent_at: new Date().toISOString() })
      .eq('id', notificationId);

    return { success: true, notificationId };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' };
  }
}
