import React, { useEffect, useRef, useState } from 'react';
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
import { Plus, Pencil, Trash2, Search, X, Truck, MapPin, Globe } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import Toast from '@/components/admin/Toast';
import { adminSupabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

type ShippingRule = {
  id: string;
  continent: string;
  country: string;
  governorate: string;
  area: string;
  shipping_fee: number;
  free_shipping_minimum: number;
  is_active: boolean;
  created_at: string;
};

const EMPTY_FORM = {
  continent: '',
  country: '',
  governorate: '',
  area: '',
  shipping_fee: '',
  free_shipping_minimum: '',
  is_active: true,
};

const WILDCARD_HINT = 'اكتب الكل أو all أو * لتطبيقها على الجميع';

function ruleScope(rule: ShippingRule): string {
  const isWild = (v: string) => isWildcard(v);
  const parts: string[] = [];
  if (rule.continent && !isWild(rule.continent)) parts.push(rule.continent);
  if (rule.country)     parts.push(isWild(rule.country)     ? 'كل الدول'       : rule.country);
  if (rule.governorate) parts.push(isWild(rule.governorate) ? 'كل المحافظات'   : rule.governorate);
  if (rule.area)        parts.push(isWild(rule.area)        ? 'كل المناطق'     : rule.area);
  return parts.join(' / ') || 'عالمي';
}

function isWildcard(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === 'all' || v === '*' || v === 'الكل';
}

function ShippingScreen() {
  const { isAdminAuthenticated } = useAdmin();
  const { isMobile } = useAdminLayout();
  const router = useRouter();

  const [rules, setRules] = useState<ShippingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<ShippingRule | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!isAdminAuthenticated) { router.replace('/admin/login'); return; }
    fetchRules();
  }, [isAdminAuthenticated]);

  const fetchRules = async () => {
    setLoading(true);
    const db = adminSupabase();
    const { data, error } = await db
      .from('shipping_rules')
      .select('*')
      .order('continent')
      .order('country')
      .order('governorate')
      .order('area');
    if (error) {
      showToast('فشل تحميل القواعد: ' + error.message, 'error');
    }
    setRules(data ?? []);
    setLoading(false);
  };

  const openAdd = () => {
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalVisible(true);
  };

  const openEdit = (r: ShippingRule) => {
    setEditingRule(r);
    setForm({
      continent: r.continent,
      country: r.country,
      governorate: r.governorate,
      area: r.area,
      shipping_fee: String(r.shipping_fee),
      free_shipping_minimum: String(r.free_shipping_minimum),
      is_active: r.is_active,
    });
    setFormError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    // At least one location field must be filled
    const hasLocation = form.continent.trim() || form.country.trim() || form.governorate.trim();
    if (!hasLocation) {
      setFormError('يجب تحديد القارة أو الدولة أو المحافظة على الأقل');
      return;
    }
    const fee = parseFloat(form.shipping_fee);
    if (isNaN(fee) || fee < 0) {
      setFormError('رسوم الشحن يجب أن تكون رقماً صحيحاً ≥ 0');
      return;
    }
    const freeMin = parseFloat(form.free_shipping_minimum || '0');
    if (isNaN(freeMin) || freeMin < 0) {
      setFormError('الحد الأدنى يجب أن يكون رقماً صحيحاً ≥ 0');
      return;
    }

    setSaving(true);
    setFormError('');

    const db = adminSupabase();
    const payload = {
      continent: form.continent.trim(),
      country: form.country.trim(),
      governorate: form.governorate.trim(),
      area: form.area.trim(),
      shipping_fee: fee,
      free_shipping_minimum: freeMin,
      is_active: form.is_active,
    };

    let err;
    if (editingRule) {
      ({ error: err } = await db.from('shipping_rules').update(payload).eq('id', editingRule.id));
    } else {
      ({ error: err } = await db.from('shipping_rules').insert(payload));
    }

    setSaving(false);

    if (err) {
      setFormError('فشل الحفظ: ' + err.message);
      return;
    }

    setModalVisible(false);
    showToast(editingRule ? 'تم تحديث قاعدة الشحن' : 'تمت إضافة قاعدة الشحن');
    fetchRules();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await adminSupabase().from('shipping_rules').delete().eq('id', deleteId);
    setDeleteId(null);
    if (error) { showToast('فشل الحذف: ' + error.message, 'error'); return; }
    showToast('تم حذف القاعدة');
    fetchRules();
  };

  const filtered = rules.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.continent.toLowerCase().includes(q) ||
      r.country.toLowerCase().includes(q) ||
      r.governorate.toLowerCase().includes(q) ||
      r.area.toLowerCase().includes(q)
    );
  });

  const content = (
    <View style={styles.container}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={() => setToast(null)} />}

      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.searchWrap}>
          <Search size={16} color={Colors.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث بالدولة أو المحافظة..."
            placeholderTextColor={Colors.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={14} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
          <Plus size={16} color={Colors.background} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>إضافة قاعدة</Text>
        </TouchableOpacity>
      </View>

      {/* Stats strip */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Truck size={14} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={styles.statText}>{rules.length} قاعدة شحن</Text>
        </View>
        <View style={styles.statChip}>
          <MapPin size={14} color={Colors.success} strokeWidth={2} />
          <Text style={styles.statText}>{rules.filter((r) => r.is_active).length} نشطة</Text>
        </View>
      </View>

      {/* Rules list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.neonBlue} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Truck size={48} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>لا توجد قواعد شحن</Text>
          <Text style={styles.emptySubtitle}>أضف أول قاعدة شحن لبدء تحصيل رسوم التوصيل</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
          {filtered.map((rule) => (
            <View key={rule.id} style={[styles.ruleCard, !rule.is_active && styles.ruleCardInactive]}>
              <View style={styles.ruleLeft}>
                <View style={styles.ruleLocRow}>
                  <MapPin size={13} color={rule.is_active ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
                  <Text style={[styles.ruleLocation, !rule.is_active && styles.textMuted]} numberOfLines={2}>
                    {ruleScope(rule)}
                  </Text>
                </View>
                <View style={styles.ruleFeeRow}>
                  <Text style={styles.ruleLabel}>رسوم الشحن: </Text>
                  <Text style={styles.ruleFee}>{rule.shipping_fee.toLocaleString()} IQD</Text>
                  {rule.free_shipping_minimum > 0 && (
                    <Text style={styles.ruleFreeMin}>
                      {'  '}مجاني فوق {rule.free_shipping_minimum.toLocaleString()} IQD
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.ruleRight}>
                <View style={[styles.statusBadge, rule.is_active ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, rule.is_active ? styles.statusTextActive : styles.statusTextInactive]}>
                    {rule.is_active ? 'نشط' : 'معطّل'}
                  </Text>
                </View>
                <View style={styles.actionBtns}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(rule)} activeOpacity={0.7}>
                    <Pencil size={15} color={Colors.neonBlue} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconBtn, styles.iconBtnDanger]} onPress={() => setDeleteId(rule.id)} activeOpacity={0.7}>
                    <Trash2 size={15} color={Colors.error} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add / Edit modal */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => !saving && setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRule ? 'تعديل قاعدة الشحن' : 'إضافة قاعدة شحن'}
              </Text>
              {!saving && (
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <X size={18} color={Colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Wildcard hint banner */}
              <View style={styles.hintBanner}>
                <Globe size={14} color={Colors.neonBlue} strokeWidth={2} />
                <Text style={styles.hintText}>{WILDCARD_HINT}</Text>
              </View>

              <FormField
                label="القارة (اختياري)"
                value={form.continent}
                onChange={(v) => setForm((f) => ({ ...f, continent: v }))}
                placeholder="مثال: Asia — أو اتركه فارغاً"
              />
              <FormField
                label="الدولة"
                value={form.country}
                onChange={(v) => setForm((f) => ({ ...f, country: v }))}
                placeholder="مثال: العراق — أو الكل / all / *"
              />
              <FormField
                label="المحافظة"
                value={form.governorate}
                onChange={(v) => setForm((f) => ({ ...f, governorate: v }))}
                placeholder="مثال: بغداد — أو الكل / all / *"
              />
              <FormField
                label="المنطقة / الحي (اختياري)"
                value={form.area}
                onChange={(v) => setForm((f) => ({ ...f, area: v }))}
                placeholder="مثال: الكرادة — أو الكل / all / * أو اتركه فارغاً"
              />
              <FormField
                label="رسوم الشحن (IQD) *"
                value={form.shipping_fee}
                onChange={(v) => setForm((f) => ({ ...f, shipping_fee: v }))}
                placeholder="مثال: 5000"
                keyboardType="numeric"
              />
              <FormField
                label="حد الشحن المجاني (IQD) — 0 يعني غير متاح"
                value={form.free_shipping_minimum}
                onChange={(v) => setForm((f) => ({ ...f, free_shipping_minimum: v }))}
                placeholder="0"
                keyboardType="numeric"
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>تفعيل القاعدة</Text>
                <Switch
                  value={form.is_active}
                  onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                  trackColor={{ true: Colors.neonBlue, false: Colors.border }}
                  thumbColor={form.is_active ? '#fff' : Colors.textMuted}
                />
              </View>

              {formError ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{formError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.background} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingRule ? 'حفظ التغييرات' : 'إضافة القاعدة'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete confirm modal */}
      <Modal
        visible={!!deleteId}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteId(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>حذف قاعدة الشحن؟</Text>
            <Text style={styles.confirmBody}>لا يمكن التراجع عن هذا الإجراء.</Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteId(null)} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
                <Text style={styles.deleteBtnText}>حذف</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );

  if (isMobile) {
    return (
      <AdminGuard>
        <AdminMobileDashboard title="الشحن">{content}</AdminMobileDashboard>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <AdminWebDashboard title="إدارة الشحن">{content}</AdminWebDashboard>
    </AdminGuard>
  );
}

function FormField({
  label, value, onChange, placeholder, keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

export default function ShippingPage() {
  return <ShippingScreen />;
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm, padding: 0 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  addBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: 60,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', maxWidth: 320, lineHeight: 20 },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  ruleCardInactive: { opacity: 0.6 },
  ruleLeft: { flex: 1, gap: 5 },
  ruleLocRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  ruleLocation: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700', flex: 1 },
  textMuted: { color: Colors.textMuted },
  ruleFeeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 2 },
  ruleLabel: { color: Colors.textMuted, fontSize: FontSize.sm },
  ruleFee: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '700' },
  ruleFreeMin: { color: Colors.success, fontSize: FontSize.xs, fontWeight: '600' },
  ruleRight: { alignItems: 'flex-end', gap: Spacing.sm },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1 },
  statusActive: { backgroundColor: Colors.success + '18', borderColor: Colors.success + '40' },
  statusInactive: { backgroundColor: Colors.border, borderColor: Colors.border },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  statusTextActive: { color: Colors.success },
  statusTextInactive: { color: Colors.textMuted },
  actionBtns: { flexDirection: 'row', gap: Spacing.xs },
  iconBtn: {
    width: 32, height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnDanger: { backgroundColor: Colors.error + '18', borderColor: Colors.error + '40' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800' },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  hintText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '600', flex: 1, lineHeight: 18 },
  field: { marginBottom: Spacing.md, gap: 5 },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  fieldInput: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  switchLabel: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600' },
  errorBanner: {
    backgroundColor: Colors.error + '18',
    borderWidth: 1,
    borderColor: Colors.error + '40',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  errorBannerText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600', lineHeight: 20 },
  saveBtn: {
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  saveBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: '800' },
  confirmBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    gap: Spacing.md,
    alignItems: 'center',
  },
  confirmTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800', textAlign: 'center' },
  confirmBody: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },
  confirmBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  cancelBtn: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  cancelBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '700' },
  deleteBtn: {
    flex: 1,
    backgroundColor: Colors.error,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  deleteBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },
});
