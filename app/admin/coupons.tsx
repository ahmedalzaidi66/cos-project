import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useRouter } from 'expo-router';
import { Plus, Pencil, Trash2, Search, X, Tag, Percent, DollarSign, Calendar } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import Toast from '@/components/admin/Toast';
import { supabase, adminSupabase, Coupon } from '@/lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { formatPrice } from '@/lib/currency';

const EMPTY_FORM = {
  code: '',
  discount_type: 'percentage' as 'percentage' | 'fixed',
  discount_value: '',
  min_order_value: '',
  expiry_date: '',
  is_active: true,
  max_uses: '',
};

function CouponsScreen() {
  const { isAdminAuthenticated } = useAdmin();
  const { isMobile } = useAdminLayout();
  const { t, language } = useLanguage();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!isAdminAuthenticated) { router.replace('/admin/login'); return; }
    fetchCoupons();
  }, [isAdminAuthenticated]);

  const fetchCoupons = async () => {
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    setCoupons(data ?? []);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingCoupon(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalVisible(true);
  };

  const openEdit = (c: Coupon) => {
    setEditingCoupon(c);
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      min_order_value: c.min_order_value ? String(c.min_order_value) : '',
      expiry_date: c.expiry_date ?? '',
      is_active: c.is_active,
      max_uses: c.max_uses ? String(c.max_uses) : '',
    });
    setError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) { setError('Coupon code is required.'); return; }
    const val = parseFloat(form.discount_value);
    if (isNaN(val) || val <= 0) { setError('Discount value must be a positive number.'); return; }
    if (form.discount_type === 'percentage' && val > 100) { setError('Percentage discount cannot exceed 100%.'); return; }

    setSaving(true);
    const payload: any = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: val,
      min_order_value: form.min_order_value ? parseFloat(form.min_order_value) : 0,
      expiry_date: form.expiry_date || null,
      is_active: form.is_active,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      updated_at: new Date().toISOString(),
    };

    const db = adminSupabase();
    if (editingCoupon) {
      const { error: err } = await db.from('coupons').update(payload).eq('id', editingCoupon.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await db.from('coupons').insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    await fetchCoupons();
    setSaving(false);
    setModalVisible(false);
    showToast(editingCoupon ? 'Coupon updated' : 'Coupon created');
  };

  const handleDelete = async (id: string) => {
    await adminSupabase().from('coupons').delete().eq('id', id);
    setDeleteId(null);
    setCoupons((prev) => prev.filter((c) => c.id !== id));
    showToast('Coupon deleted');
  };

  const isExpired = (coupon: Coupon) => {
    if (!coupon.expiry_date) return false;
    return new Date(coupon.expiry_date) < new Date();
  };

  const filtered = coupons.filter((c) =>
    search.trim() === '' || c.code.toLowerCase().includes(search.toLowerCase())
  );

  const Shell = isMobile ? AdminMobileDashboard : AdminWebDashboard;

  if (loading) {
    return (
      <Shell title={t.coupons}>
        <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 60 }} />
      </Shell>
    );
  }

  return (
    <Shell title={t.coupons}>
      <View style={styles.container}>
        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <Search size={15} color={Colors.textMuted} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder={t.searchCoupons}
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
            <Plus size={16} color={Colors.background} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>{t.addCoupon}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.countText}>{filtered.length} coupon{filtered.length !== 1 ? 's' : ''}</Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 1.5 }]}>{t.colCode}</Text>
          <Text style={[styles.th, { flex: 1 }]}>{t.colDiscount}</Text>
          <Text style={[styles.th, { flex: 1 }]}>{t.colMinOrder}</Text>
          <Text style={[styles.th, { flex: 1 }]}>{t.colExpiry}</Text>
          <Text style={[styles.th, { flex: 0.8 }]}>{t.colUses}</Text>
          <Text style={[styles.th, { flex: 0.7 }]}>{t.colStatus}</Text>
          <Text style={[styles.th, { width: 80, textAlign: 'center' }]}>{t.colActions}</Text>
        </View>

        {filtered.map((coupon) => {
          const expired = isExpired(coupon);
          const active = coupon.is_active && !expired;
          return (
            <View key={coupon.id} style={styles.tableRow}>
              <View style={[{ flex: 1.5 }]}>
                <View style={styles.codeRow}>
                  <Tag size={12} color={Colors.neonBlue} strokeWidth={2} />
                  <Text style={styles.codeText}>{coupon.code}</Text>
                </View>
                <Text style={styles.typeLabel}>
                  {coupon.discount_type === 'percentage' ? t.percentage : t.fixedAmount}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.discountValue}>
                  {coupon.discount_type === 'percentage'
                    ? `${coupon.discount_value}%`
                    : formatPrice(coupon.discount_value, language)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cellText}>
                  {coupon.min_order_value > 0 ? formatPrice(coupon.min_order_value, language) : t.noMinOrder}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cellText, expired && { color: Colors.error }]}>
                  {coupon.expiry_date
                    ? new Date(coupon.expiry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                    : t.never}
                </Text>
                {expired && <Text style={styles.expiredLabel}>{t.expired}</Text>}
              </View>
              <View style={{ flex: 0.8 }}>
                <Text style={styles.cellText}>
                  {coupon.usage_count}{coupon.max_uses ? `/${coupon.max_uses}` : ''}
                </Text>
              </View>
              <View style={{ flex: 0.7 }}>
                <View style={[styles.statusBadge, {
                  backgroundColor: active ? Colors.success + '1A' : Colors.error + '1A',
                  borderColor: active ? Colors.success + '44' : Colors.error + '44',
                }]}>
                  <View style={[styles.statusDot, { backgroundColor: active ? Colors.success : Colors.error }]} />
                  <Text style={[styles.statusBadgeText, { color: active ? Colors.success : Colors.error }]}>
                    {active ? t.active : t.inactive}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(coupon)} activeOpacity={0.7}>
                  <Pencil size={14} color={Colors.neonBlue} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteId(coupon.id)} activeOpacity={0.7}>
                  <Trash2 size={14} color={Colors.error} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Tag size={48} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>{t.noCouponsYet}</Text>
            <Text style={styles.emptySubtitle}>{t.createFirstCoupon}</Text>
          </View>
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCoupon ? t.editCoupon : t.addCoupon}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <FieldLabel label={t.couponCodeLabel} />
              <TextInput
                style={styles.input}
                value={form.code}
                onChangeText={(v) => setForm({ ...form, code: v.toUpperCase() })}
                placeholder={t.couponCodePlaceholder}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
              />
              <Text style={styles.hintText}>{t.couponHint}</Text>

              <FieldLabel label={t.discountTypeLabel} />
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, form.discount_type === 'percentage' && styles.typeBtnActive]}
                  onPress={() => setForm({ ...form, discount_type: 'percentage' })}
                >
                  <Percent size={15} color={form.discount_type === 'percentage' ? Colors.background : Colors.textMuted} strokeWidth={2.5} />
                  <Text style={[styles.typeBtnText, form.discount_type === 'percentage' && styles.typeBtnTextActive]}>{t.percentage}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, form.discount_type === 'fixed' && styles.typeBtnActive]}
                  onPress={() => setForm({ ...form, discount_type: 'fixed' })}
                >
                  <DollarSign size={15} color={form.discount_type === 'fixed' ? Colors.background : Colors.textMuted} strokeWidth={2.5} />
                  <Text style={[styles.typeBtnText, form.discount_type === 'fixed' && styles.typeBtnTextActive]}>{t.fixedAmount}</Text>
                </TouchableOpacity>
              </View>

              <FieldLabel label={`${t.discountValueLabel} ${form.discount_type === 'percentage' ? '(%)' : '($)'}`} />
              <TextInput
                style={styles.input}
                value={form.discount_value}
                onChangeText={(v) => setForm({ ...form, discount_value: v })}
                placeholder={form.discount_type === 'percentage' ? '10' : '25.00'}
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />

              <FieldLabel label={t.minOrderLabel} />
              <TextInput
                style={styles.input}
                value={form.min_order_value}
                onChangeText={(v) => setForm({ ...form, min_order_value: v })}
                placeholder={t.minOrderPlaceholder}
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />

              <FieldLabel label={t.expiryDate} />
              <View style={styles.inputIconRow}>
                <Calendar size={15} color={Colors.textMuted} strokeWidth={2} />
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                  value={form.expiry_date}
                  onChangeText={(v) => setForm({ ...form, expiry_date: v })}
                  placeholder={t.expiryPlaceholder}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <FieldLabel label={t.maxUsesLabel} />
              <TextInput
                style={styles.input}
                value={form.max_uses}
                onChangeText={(v) => setForm({ ...form, max_uses: v })}
                placeholder={t.maxUsesPlaceholder}
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t.activeCoupon}</Text>
                <Switch
                  value={form.is_active}
                  onValueChange={(v) => setForm({ ...form, is_active: v })}
                  trackColor={{ true: Colors.success, false: Colors.border }}
                  thumbColor={Colors.white}
                />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={Colors.background} size="small" /> : <Text style={styles.saveBtnText}>{editingCoupon ? t.updateCoupon : t.createCoupon}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!deleteId} transparent animationType="fade" onRequestClose={() => setDeleteId(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 360 }]}>
            <Text style={[styles.modalTitle, { padding: Spacing.lg }]}>{t.deleteCoupon}</Text>
            <Text style={[styles.errorText, { paddingHorizontal: Spacing.lg }]}>{t.deleteCouponWarning}</Text>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteId(null)}>
                <Text style={styles.cancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.error }]} onPress={() => deleteId && handleDelete(deleteId)}>
                <Text style={styles.saveBtnText}>{t.delete}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast visible={!!toast} message={toast?.message ?? ''} type={toast?.type} />
    </Shell>
  );
}

export default function CouponsScreenGuarded() {
  return (
    <AdminGuard permission="manage_coupons">
      <CouponsScreen />
    </AdminGuard>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44 },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.neonBlue, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 44 },
  addBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '700' },
  countText: { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.md },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.sm, marginBottom: 2 },
  th: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.md, backgroundColor: Colors.backgroundCard, borderRadius: Radius.md, marginBottom: 4, borderWidth: 1, borderColor: Colors.border },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  codeText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '800', fontFamily: 'monospace' as any, letterSpacing: 0.5 },
  typeLabel: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  discountValue: { color: Colors.neonBlue, fontSize: FontSize.md, fontWeight: '800' },
  cellText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500' },
  expiredLabel: { color: Colors.error, fontSize: FontSize.xs, fontWeight: '600', marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, alignSelf: 'flex-start' },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  actions: { width: 80, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  editBtn: { width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: Colors.neonBlueGlow, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: Colors.errorDim, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '700' },
  emptySubtitle: { color: Colors.textMuted, fontSize: FontSize.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.md },
  modalCard: { backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.xl, width: '100%', maxWidth: 560, maxHeight: '90%', borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800' },
  modalBody: { padding: Spacing.lg, maxHeight: 500 },
  modalFooter: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg },
  fieldLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: Spacing.sm },
  input: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, color: Colors.textPrimary, fontSize: FontSize.md, marginBottom: 2 },
  hintText: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: 4 },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: 4 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  typeBtnActive: { backgroundColor: Colors.neonBlue, borderColor: Colors.neonBlue },
  typeBtnText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '700' },
  typeBtnTextActive: { color: Colors.background },
  inputIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 2, marginBottom: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md },
  switchLabel: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600' },
  cancelBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  saveBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.neonBlue, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: '800' },
  errorText: { color: Colors.error, fontSize: FontSize.sm, marginBottom: Spacing.sm },
});
