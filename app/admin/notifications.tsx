import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Switch, Modal,
} from 'react-native';
import { Bell, Send, Plus, X, Check, Clock, CircleAlert as AlertCircle, Mail, MessageSquare, Smartphone, Wifi, Users, User, ChevronDown, ChevronUp, RefreshCw, Trash2 } from 'lucide-react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import Toast from '@/components/admin/Toast';
import { adminSupabase, supabase } from '@/lib/supabase';
import { useAdmin } from '@/context/AdminContext';
import { logAdminAction } from '@/lib/auditLog';
import {
  adminSendNotification,
  type NotificationType,
  type NotificationChannel,
  type AdminNotification,
  type CustomerRow,
} from '@/context/NotificationContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

type ToastState = { message: string; type: 'success' | 'error' };

const TYPE_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: 'offer', label: 'Offer / Promo' },
  { value: 'new_product', label: 'New Product' },
  { value: 'custom', label: 'Custom' },
];

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string; icon: any; color: string }[] = [
  { value: 'app',       label: 'App Notification', icon: Smartphone, color: Colors.neonBlue },
  { value: 'push',      label: 'Push (future)',    icon: Wifi,       color: Colors.success },
  { value: 'whatsapp',  label: 'WhatsApp',         icon: MessageSquare, color: '#25D366' },
  { value: 'email',     label: 'Email',            icon: Mail,       color: Colors.warning },
];

const STATUS_COLORS: Record<string, string> = {
  sent:   Colors.success,
  failed: Colors.error,
  draft:  Colors.textMuted,
};

function NotificationsContent() {
  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotificationType>('custom');
  const [channels, setChannels] = useState<Set<NotificationChannel>>(new Set(['app']));
  const [target, setTarget] = useState<'all' | 'selected'>('all');
  const [manualInput, setManualInput] = useState('');
  const [manualContacts, setManualContacts] = useState<{ phone?: string; email?: string }[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);

  // Data
  const [history, setHistory] = useState<AdminNotification[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { admin } = useAdmin();

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const db = adminSupabase();
    const { data } = await db
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setHistory(data ?? []);
    setLoadingHistory(false);
  }, []);

  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    const db = adminSupabase();
    const { data } = await db
      .from('customers')
      .select('id, name, email, phone, whatsapp_opt_in, email_opt_in, app_opt_in, created_at')
      .order('created_at', { ascending: false });
    setCustomers((data ?? []) as CustomerRow[]);
    setLoadingCustomers(false);
  }, []);

  useEffect(() => {
    loadHistory();
    loadCustomers();
  }, []);

  const toggleChannel = (ch: NotificationChannel) => {
    setChannels(prev => {
      const next = new Set(prev);
      if (next.has(ch)) { if (next.size > 1) next.delete(ch); }
      else next.add(ch);
      return next;
    });
  };

  const addManualContact = () => {
    const val = manualInput.trim();
    if (!val) return;
    if (val.includes('@')) {
      setManualContacts(prev => [...prev, { email: val }]);
    } else {
      setManualContacts(prev => [...prev, { phone: val }]);
    }
    setManualInput('');
  };

  const removeManualContact = (idx: number) => {
    setManualContacts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    if (!title.trim()) { showToast('Title is required', 'error'); return; }
    if (!message.trim()) { showToast('Message is required', 'error'); return; }
    if (channels.size === 0) { showToast('Select at least one channel', 'error'); return; }
    setSending(true);
    const result = await adminSendNotification({
      title: title.trim(),
      message: message.trim(),
      type,
      channels: [...channels],
      target,
      selectedCustomerIds: target === 'selected' ? [...selectedCustomerIds] : undefined,
      manualContacts: manualContacts.length > 0 ? manualContacts : undefined,
    });
    setSending(false);
    setShowPreview(false);
    if (result.success) {
      showToast('Notification sent successfully');
      setTitle(''); setMessage(''); setManualContacts([]); setSelectedCustomerIds(new Set());
      loadHistory();
    } else {
      showToast('Send failed: ' + (result.error ?? 'Unknown error'), 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const notif = history.find(n => n.id === id);
    await adminSupabase().from('notifications').delete().eq('id', id);
    setHistory(prev => prev.filter(n => n.id !== id));
    setConfirmDeleteId(null);
    showToast('Notification deleted');
    logAdminAction({ action: 'delete', entityType: 'notification', entityId: id, entityLabel: notif?.title, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '' });
  };

  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q);
  });

  return (
    <View style={styles.container}>
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* ── Compose Form ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Bell size={18} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.cardTitle}>Compose Notification</Text>
        </View>

        <Text style={styles.fieldLabel}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Notification title..."
          placeholderTextColor={Colors.textMuted}
        />

        <Text style={styles.fieldLabel}>Message *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={message}
          onChangeText={setMessage}
          placeholder="Write your message here..."
          placeholderTextColor={Colors.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Type */}
        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.chipRow}>
          {TYPE_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.typeChip, type === opt.value && styles.typeChipActive]}
              onPress={() => setType(opt.value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.typeChipText, type === opt.value && styles.typeChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Channels */}
        <Text style={styles.fieldLabel}>Channels</Text>
        <View style={styles.channelGrid}>
          {CHANNEL_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const on = channels.has(opt.value);
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.channelCard, on && { borderColor: opt.color, backgroundColor: opt.color + '14' }]}
                onPress={() => toggleChannel(opt.value)}
                activeOpacity={0.8}
              >
                <Icon size={18} color={on ? opt.color : Colors.textMuted} strokeWidth={2} />
                <Text style={[styles.channelCardText, on && { color: opt.color }]}>{opt.label}</Text>
                <View style={[styles.channelCheckbox, on && { backgroundColor: opt.color, borderColor: opt.color }]}>
                  {on && <Check size={10} color="#fff" strokeWidth={3} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Target */}
        <Text style={styles.fieldLabel}>Target Audience</Text>
        <View style={styles.chipRow}>
          <TouchableOpacity
            style={[styles.typeChip, target === 'all' && styles.typeChipActive]}
            onPress={() => setTarget('all')}
            activeOpacity={0.75}
          >
            <Users size={13} color={target === 'all' ? Colors.background : Colors.textMuted} strokeWidth={2.5} />
            <Text style={[styles.typeChipText, target === 'all' && styles.typeChipTextActive]}>All Customers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeChip, target === 'selected' && styles.typeChipActive]}
            onPress={() => { setTarget('selected'); setShowCustomerPicker(true); }}
            activeOpacity={0.75}
          >
            <User size={13} color={target === 'selected' ? Colors.background : Colors.textMuted} strokeWidth={2.5} />
            <Text style={[styles.typeChipText, target === 'selected' && styles.typeChipTextActive]}>
              Selected ({selectedCustomerIds.size})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Manual contacts */}
        <Text style={styles.fieldLabel}>Manual Phone / Email</Text>
        <View style={styles.manualRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={manualInput}
            onChangeText={setManualInput}
            placeholder="+9647xxxxxxxx or email@example.com"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            onSubmitEditing={addManualContact}
          />
          <TouchableOpacity style={styles.addContactBtn} onPress={addManualContact} activeOpacity={0.8}>
            <Plus size={16} color={Colors.background} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        {manualContacts.map((c, i) => (
          <View key={i} style={styles.contactChip}>
            {c.email
              ? <Mail size={12} color={Colors.neonBlue} strokeWidth={2} />
              : <MessageSquare size={12} color={Colors.neonBlue} strokeWidth={2} />}
            <Text style={styles.contactChipText}>{c.email ?? c.phone}</Text>
            <TouchableOpacity onPress={() => removeManualContact(i)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <X size={12} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Action buttons */}
        <View style={styles.formActions}>
          <TouchableOpacity style={styles.previewBtn} onPress={() => setShowPreview(true)} activeOpacity={0.8}>
            <Bell size={15} color={Colors.neonBlue} strokeWidth={2} />
            <Text style={styles.previewBtnText}>Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendBtn, sending && { opacity: 0.6 }]}
            onPress={handleSend}
            activeOpacity={0.85}
            disabled={sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Send size={15} color="#fff" strokeWidth={2.5} /><Text style={styles.sendBtnText}>SEND</Text></>}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── History ── */}
      <View style={[styles.card, { marginTop: Spacing.lg }]}>
        <View style={styles.cardHeader}>
          <Clock size={18} color={Colors.textSecondary} strokeWidth={2} />
          <Text style={styles.cardTitle}>Notification History</Text>
          <TouchableOpacity onPress={loadHistory} style={{ marginLeft: 'auto' }} activeOpacity={0.7}>
            <RefreshCw size={15} color={Colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {loadingHistory ? (
          <ActivityIndicator color={Colors.neonBlue} style={{ margin: Spacing.lg }} />
        ) : history.length === 0 ? (
          <Text style={styles.emptyText}>No notifications sent yet.</Text>
        ) : (
          history.map(n => (
            <View key={n.id} style={styles.historyRow}>
              <View style={styles.historyLeft}>
                <View style={styles.historyTopRow}>
                  <Text style={styles.historyTitle} numberOfLines={1}>{n.title}</Text>
                  <View style={[styles.statusBadge, { borderColor: STATUS_COLORS[n.status] + '60' }]}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[n.status] }]} />
                    <Text style={[styles.statusText, { color: STATUS_COLORS[n.status] }]}>{n.status}</Text>
                  </View>
                </View>
                <Text style={styles.historyMessage} numberOfLines={1}>{n.message}</Text>
                <View style={styles.historyMeta}>
                  <Text style={styles.historyMetaText}>{n.type} · {n.channel}</Text>
                  <Text style={styles.historyMetaText}>{new Date(n.created_at).toLocaleDateString()}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setConfirmDeleteId(n.id)}
                style={styles.deleteBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Trash2 size={14} color={Colors.error} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* ── Preview Modal ── */}
      <Modal visible={showPreview} transparent animationType="fade" onRequestClose={() => setShowPreview(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.previewModal}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Preview</Text>
              <TouchableOpacity onPress={() => setShowPreview(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={18} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Mock phone notification */}
            <View style={styles.mockNotif}>
              <View style={styles.mockNotifIcon}>
                <Bell size={20} color={Colors.neonBlue} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mockNotifTitle}>{title || 'Notification Title'}</Text>
                <Text style={styles.mockNotifMsg} numberOfLines={3}>{message || 'Notification message preview...'}</Text>
                <Text style={styles.mockNotifTime}>Just now</Text>
              </View>
            </View>

            <View style={styles.previewMeta}>
              <Text style={styles.previewMetaItem}>Type: <Text style={styles.previewMetaVal}>{type}</Text></Text>
              <Text style={styles.previewMetaItem}>Channels: <Text style={styles.previewMetaVal}>{[...channels].join(', ')}</Text></Text>
              <Text style={styles.previewMetaItem}>Target: <Text style={styles.previewMetaVal}>{target === 'all' ? 'All customers' : `${selectedCustomerIds.size} selected`}</Text></Text>
              {manualContacts.length > 0 && (
                <Text style={styles.previewMetaItem}>+ {manualContacts.length} manual contact(s)</Text>
              )}
            </View>

            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.previewCancelBtn} onPress={() => setShowPreview(false)} activeOpacity={0.8}>
                <Text style={styles.previewCancelText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, { flex: 1 }, sending && { opacity: 0.6 }]}
                onPress={handleSend}
                activeOpacity={0.85}
                disabled={sending}
              >
                {sending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Send size={15} color="#fff" strokeWidth={2.5} /><Text style={styles.sendBtnText}>SEND NOW</Text></>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal visible={!!confirmDeleteId} transparent animationType="fade" onRequestClose={() => setConfirmDeleteId(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.previewModal, { maxWidth: 360 }]}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Delete Notification?</Text>
              <TouchableOpacity onPress={() => setConfirmDeleteId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={18} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: Spacing.lg }}>
              <Text style={{ color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.lg }}>
                {history.find(n => n.id === confirmDeleteId)?.title ?? ''}
              </Text>
              <Text style={{ color: Colors.warning, fontSize: FontSize.xs, marginBottom: Spacing.lg }}>
                This notification record will be permanently removed.
              </Text>
              <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                <TouchableOpacity
                  style={{ flex: 1, height: 44, borderRadius: Radius.md, backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => setConfirmDeleteId(null)}
                >
                  <Text style={{ color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.sm }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, height: 44, borderRadius: Radius.md, backgroundColor: Colors.error, justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => confirmDeleteId && handleDelete(confirmDeleteId)}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: FontSize.sm }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Customer Picker Modal ── */}
      <Modal visible={showCustomerPicker} transparent animationType="slide" onRequestClose={() => setShowCustomerPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.previewModal, { maxHeight: '80%' }]}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Select Customers ({selectedCustomerIds.size} selected)</Text>
              <TouchableOpacity onPress={() => setShowCustomerPicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={18} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { marginHorizontal: Spacing.md, marginBottom: Spacing.sm }]}
              value={customerSearch}
              onChangeText={setCustomerSearch}
              placeholder="Search customers..."
              placeholderTextColor={Colors.textMuted}
            />

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {loadingCustomers ? (
                <ActivityIndicator color={Colors.neonBlue} style={{ margin: Spacing.lg }} />
              ) : filteredCustomers.length === 0 ? (
                <Text style={[styles.emptyText, { margin: Spacing.lg }]}>No customers found.</Text>
              ) : (
                filteredCustomers.map(c => {
                  const selected = selectedCustomerIds.has(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.customerPickRow, selected && styles.customerPickRowSelected]}
                      onPress={() => {
                        setSelectedCustomerIds(prev => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                          return next;
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.customerPickCheck, selected && styles.customerPickCheckActive]}>
                        {selected && <Check size={10} color="#fff" strokeWidth={3} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customerPickName}>{c.name || c.email || 'Unknown'}</Text>
                        <Text style={styles.customerPickMeta}>{c.email}{c.phone ? ` · ${c.phone}` : ''}</Text>
                        <View style={styles.customerOptIns}>
                          {c.app_opt_in && <Text style={styles.optInTag}>App</Text>}
                          {c.email_opt_in && <Text style={styles.optInTag}>Email</Text>}
                          {c.whatsapp_opt_in && <Text style={styles.optInTag}>WhatsApp</Text>}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.sendBtn, { margin: Spacing.md }]}
              onPress={() => setShowCustomerPicker(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.sendBtnText}>Done ({selectedCustomerIds.size} selected)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function NotificationsScreen() {
  const { isMobile } = useAdminLayout();
  if (isMobile) {
    return (
      <AdminMobileDashboard title="Notifications" showBack>
        <NotificationsContent />
      </AdminMobileDashboard>
    );
  }
  return (
    <AdminWebDashboard title="Notifications">
      <NotificationsContent />
    </AdminWebDashboard>
  );
}

export default function NotificationsScreenGuarded() {
  return (
    <AdminGuard permission="manage_customers">
      <NotificationsScreen />
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 48 },

  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: '800',
  },

  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.xs,
  },
  textArea: { height: 90, textAlignVertical: 'top', paddingTop: 10 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.xs },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1, borderColor: Colors.border,
  },
  typeChipActive: { backgroundColor: Colors.neonBlue, borderColor: Colors.neonBlue },
  typeChipText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  typeChipTextActive: { color: Colors.background },

  channelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.xs },
  channelCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary, flex: 1, minWidth: 140,
  },
  channelCardText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', flex: 1 },
  channelCheckbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },

  manualRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: Spacing.xs },
  addContactBtn: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.neonBlue,
    justifyContent: 'center', alignItems: 'center',
  },
  contactChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.neonBlueGlow, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.neonBlueBorder,
    alignSelf: 'flex-start', marginBottom: 4,
  },
  contactChipText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '600' },

  formActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  previewBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: Radius.md,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1, borderColor: Colors.neonBlueBorder,
  },
  previewBtnText: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '700' },
  sendBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, borderRadius: Radius.md,
    backgroundColor: Colors.neonBlue,
  },
  sendBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '900', letterSpacing: 0.5 },

  // History
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.lg },
  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  historyLeft: { flex: 1, gap: 3 },
  historyTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTitle: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700', flex: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radius.full, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  historyMessage: { color: Colors.textMuted, fontSize: FontSize.xs },
  historyMeta: { flexDirection: 'row', gap: 10 },
  historyMetaText: { color: Colors.textMuted, fontSize: 10, textTransform: 'capitalize' },
  deleteBtn: {
    width: 32, height: 32, borderRadius: Radius.sm,
    backgroundColor: Colors.error + '15',
    justifyContent: 'center', alignItems: 'center',
  },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.lg,
  },
  previewModal: {
    width: '100%', maxWidth: 480,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  previewTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },

  mockNotif: {
    flexDirection: 'row', gap: 12, padding: Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  mockNotifIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.neonBlueGlow, borderWidth: 1, borderColor: Colors.neonBlueBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  mockNotifTitle: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '800', marginBottom: 3 },
  mockNotifMsg: { color: Colors.textSecondary, fontSize: FontSize.xs, lineHeight: 16 },
  mockNotifTime: { color: Colors.textMuted, fontSize: 10, marginTop: 4 },

  previewMeta: { padding: Spacing.lg, gap: 6 },
  previewMetaItem: { color: Colors.textMuted, fontSize: FontSize.xs },
  previewMetaVal: { color: Colors.textPrimary, fontWeight: '700' },

  previewActions: {
    flexDirection: 'row', gap: Spacing.sm,
    padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  previewCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  previewCancelText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '700' },

  // Customer picker
  customerPickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: Spacing.md, marginHorizontal: Spacing.md, marginBottom: 4,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  customerPickRowSelected: { borderColor: Colors.neonBlue, backgroundColor: Colors.neonBlueGlow },
  customerPickCheck: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1.5, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  customerPickCheckActive: { backgroundColor: Colors.neonBlue, borderColor: Colors.neonBlue },
  customerPickName: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700' },
  customerPickMeta: { color: Colors.textMuted, fontSize: FontSize.xs },
  customerOptIns: { flexDirection: 'row', gap: 5, marginTop: 3 },
  optInTag: {
    color: Colors.neonBlue, fontSize: 9, fontWeight: '800',
    backgroundColor: Colors.neonBlueGlow, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
  },
});
