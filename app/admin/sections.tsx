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
  Image,
} from 'react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useRouter } from 'expo-router';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronUp,
  ChevronDown,
  Package,
  LayoutList,
  Check,
  Search,
} from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { logAdminAction } from '@/lib/auditLog';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import Toast from '@/components/admin/Toast';
import { adminSupabase, fetchProducts, getProductName, getProductImage } from '@/lib/supabase';
import type { Product } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = {
  id: string;
  title_ar: string;
  title_en: string;
  is_active: boolean;
  sort_order: number;
};

type SectionProduct = {
  id: string;
  section_id: string;
  product_id: string;
  sort_order: number;
};

const EMPTY_FORM = { title_ar: '', title_en: '', is_active: true };

// ─── Page entry ───────────────────────────────────────────────────────────────

function SectionsScreen() {
  const { isAdminAuthenticated } = useAdmin();
  const { isMobile } = useAdminLayout();
  const router = useRouter();

  useEffect(() => {
    if (!isAdminAuthenticated) router.replace('/admin/login');
  }, [isAdminAuthenticated]);

  const content = <SectionsContent />;

  if (isMobile) {
    return (
      <AdminGuard permission="manage_cms">
        <AdminMobileDashboard title="أقسام الصفحة الرئيسية" showBack>{content}</AdminMobileDashboard>
      </AdminGuard>
    );
  }
  return (
    <AdminGuard permission="manage_cms">
      <AdminWebDashboard title="أقسام الصفحة الرئيسية">{content}</AdminWebDashboard>
    </AdminGuard>
  );
}

export default function AdminSectionsPage() {
  return <SectionsScreen />;
}

// ─── Main content ─────────────────────────────────────────────────────────────

function SectionsContent() {
  const { language } = useLanguage();
  const { admin } = useAdmin();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Section form
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Products panel
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [sectionProducts, setSectionProducts] = useState<SectionProduct[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productPanelVisible, setProductPanelVisible] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // ── Load sections ──────────────────────────────────────────────────────────

  const fetchSections = async () => {
    setLoading(true);
    const { data, error } = await adminSupabase()
      .from('homepage_sections')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) showToast('فشل تحميل الأقسام: ' + error.message, 'error');
    setSections((data as Section[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchSections(); }, []);

  // ── Section CRUD ────────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingSection(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalVisible(true);
  };

  const openEdit = (section: Section) => {
    setEditingSection(section);
    setForm({ title_ar: section.title_ar, title_en: section.title_en, is_active: section.is_active });
    setFormError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title_en.trim() && !form.title_ar.trim()) {
      setFormError('يجب إدخال عنوان بالعربية أو الإنجليزية على الأقل');
      return;
    }
    setSaving(true);
    setFormError('');

    const db = adminSupabase();

    if (editingSection) {
      const { error } = await db
        .from('homepage_sections')
        .update({ title_ar: form.title_ar, title_en: form.title_en, is_active: form.is_active })
        .eq('id', editingSection.id);
      setSaving(false);
      if (error) { setFormError('فشل الحفظ: ' + error.message); return; }
      // Sync title changes into page_blocks content
      await db
        .from('page_blocks')
        .update({
          visible: form.is_active,
          content: { section_id: editingSection.id, title_en: form.title_en, title_ar: form.title_ar, is_active: form.is_active },
          updated_at: new Date().toISOString(),
        })
        .eq('type', 'section_row')
        .filter('content->>section_id', 'eq', editingSection.id);
      showToast('تم حفظ التعديلات');
      logAdminAction({ action: 'update', entityType: 'content', entityId: editingSection.id, entityLabel: form.title_en || form.title_ar, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
    } else {
      const nextOrder = sections.length > 0 ? Math.max(...sections.map(s => s.sort_order)) + 1 : 1;
      const { data: newSection, error } = await db
        .from('homepage_sections')
        .insert({ title_ar: form.title_ar, title_en: form.title_en, is_active: form.is_active, sort_order: nextOrder })
        .select()
        .maybeSingle();
      setSaving(false);
      if (error || !newSection) { setFormError('فشل الإنشاء: ' + (error?.message ?? '')); return; }
      // Auto-add a section_row block to page_blocks at the end of the layout
      const { data: layoutRow } = await db
        .from('page_layouts').select('id').eq('page', 'home').maybeSingle();
      if (layoutRow) {
        const { data: maxRow } = await db
          .from('page_blocks')
          .select('order_index')
          .eq('layout_id', layoutRow.id)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle();
        await db.from('page_blocks').insert({
          layout_id: layoutRow.id,
          type: 'section_row',
          order_index: (maxRow?.order_index ?? 6) + 1,
          visible: form.is_active,
          content: { section_id: newSection.id, title_en: form.title_en, title_ar: form.title_ar, is_active: form.is_active },
          updated_at: new Date().toISOString(),
        });
      }
      showToast('تم إنشاء القسم');
    logAdminAction({ action: 'create', entityType: 'content', entityLabel: form.title_en || form.title_ar, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
    }

    setModalVisible(false);
    fetchSections();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const section = sections.find(s => s.id === deleteId);
    const db = adminSupabase();
    // Remove corresponding page_blocks entry first
    await db
      .from('page_blocks')
      .delete()
      .eq('type', 'section_row')
      .filter('content->>section_id', 'eq', deleteId);
    const { error } = await db.from('homepage_sections').delete().eq('id', deleteId);
    setDeleteId(null);
    if (error) { showToast('فشل الحذف: ' + error.message, 'error'); return; }
    showToast('تم حذف القسم');
    logAdminAction({ action: 'delete', entityType: 'content', entityId: deleteId, entityLabel: section?.title_en || section?.title_ar, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
    fetchSections();
  };

  const toggleActive = async (section: Section) => {
    const { error } = await adminSupabase()
      .from('homepage_sections')
      .update({ is_active: !section.is_active })
      .eq('id', section.id);
    if (error) { showToast('فشل التحديث: ' + error.message, 'error'); return; }
    setSections(prev => prev.map(s => s.id === section.id ? { ...s, is_active: !s.is_active } : s));
  };

  const moveSection = async (id: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex(s => s.id === id);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sections.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const db = adminSupabase();
    const aOrder = sections[idx].sort_order;
    const bOrder = sections[swapIdx].sort_order;
    const [r1, r2] = await Promise.all([
      db.from('homepage_sections').update({ sort_order: bOrder }).eq('id', sections[idx].id),
      db.from('homepage_sections').update({ sort_order: aOrder }).eq('id', sections[swapIdx].id),
    ]);
    if (r1.error || r2.error) { showToast('فشل إعادة الترتيب', 'error'); return; }
    fetchSections();
  };

  // ── Products panel ──────────────────────────────────────────────────────────

  const openProductsPanel = async (section: Section) => {
    setActiveSectionId(section.id);
    setProductSearch('');
    setProductPanelVisible(true);
    setLoadingProducts(true);
    const [products, spResult] = await Promise.all([
      fetchProducts({ language }),
      adminSupabase()
        .from('homepage_section_products')
        .select('*')
        .eq('section_id', section.id)
        .order('sort_order', { ascending: true }),
    ]);
    setAllProducts(products);
    if (!spResult.error && spResult.data) setSectionProducts(spResult.data as SectionProduct[]);
    setLoadingProducts(false);
  };

  const closeProductsPanel = () => {
    setProductPanelVisible(false);
    setActiveSectionId(null);
    setSectionProducts([]);
    setAllProducts([]);
  };

  const isProductInSection = (productId: string) =>
    sectionProducts.some(sp => sp.product_id === productId);

  const toggleProduct = async (product: Product) => {
    if (!activeSectionId) return;
    const db = adminSupabase();
    if (isProductInSection(product.id)) {
      const { error } = await db
        .from('homepage_section_products')
        .delete()
        .eq('section_id', activeSectionId)
        .eq('product_id', product.id);
      if (error) { showToast('فشل إزالة المنتج: ' + error.message, 'error'); return; }
      setSectionProducts(prev => prev.filter(sp => sp.product_id !== product.id));
    } else {
      const nextOrder = sectionProducts.length > 0 ? Math.max(...sectionProducts.map(sp => sp.sort_order)) + 1 : 1;
      const { data, error } = await db
        .from('homepage_section_products')
        .insert({ section_id: activeSectionId, product_id: product.id, sort_order: nextOrder })
        .select()
        .single();
      if (error) { showToast('فشل إضافة المنتج: ' + error.message, 'error'); return; }
      if (data) setSectionProducts(prev => [...prev, data as SectionProduct]);
    }
  };

  const moveProduct = async (productId: string, direction: 'up' | 'down') => {
    const idx = sectionProducts.findIndex(sp => sp.product_id === productId);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sectionProducts.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const db = adminSupabase();
    const aOrder = sectionProducts[idx].sort_order;
    const bOrder = sectionProducts[swapIdx].sort_order;
    await Promise.all([
      db.from('homepage_section_products').update({ sort_order: bOrder }).eq('id', sectionProducts[idx].id),
      db.from('homepage_section_products').update({ sort_order: aOrder }).eq('id', sectionProducts[swapIdx].id),
    ]);
    const updated = [...sectionProducts];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    setSectionProducts(updated);
  };

  // ── Filtered products for picker ────────────────────────────────────────────

  const filteredProducts = allProducts.filter(p => {
    if (!productSearch.trim()) return true;
    return getProductName(p, language).toLowerCase().includes(productSearch.toLowerCase());
  });

  const activeSection = sections.find(s => s.id === activeSectionId);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={st.container}>
      {toast && <Toast message={toast.message} type={toast.type} onHide={() => setToast(null)} />}

      {/* Header row */}
      <View style={st.headerRow}>
        <View style={st.headerLeft}>
          <LayoutList size={18} color={Colors.neonBlue} strokeWidth={2} />
          <Text style={st.headerTitle}>أقسام الصفحة الرئيسية</Text>
          <View style={st.countBadge}>
            <Text style={st.countText}>{sections.length}</Text>
          </View>
        </View>
        <TouchableOpacity style={st.addBtn} onPress={openAdd} activeOpacity={0.85}>
          <Plus size={15} color={Colors.background} strokeWidth={2.5} />
          <Text style={st.addBtnText}>قسم جديد</Text>
        </TouchableOpacity>
      </View>

      <Text style={st.subtitle}>
        تحكم في صفوف المنتجات على الصفحة الرئيسية — الأقسام النشطة تظهر للزوار مرتبة حسب الترتيب
      </Text>

      {/* List */}
      {loading ? (
        <View style={st.center}>
          <ActivityIndicator color={Colors.neonBlue} size="large" />
        </View>
      ) : sections.length === 0 ? (
        <View style={st.center}>
          <LayoutList size={48} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={st.emptyTitle}>لا توجد أقسام بعد</Text>
          <Text style={st.emptySubtitle}>أنشئ أول قسم لإضافة صف منتجات على الصفحة الرئيسية</Text>
          <TouchableOpacity style={st.addBtn} onPress={openAdd} activeOpacity={0.85}>
            <Plus size={15} color={Colors.background} strokeWidth={2.5} />
            <Text style={st.addBtnText}>إنشاء قسم</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm }}>
          {sections.map((section, idx) => (
            <View key={section.id} style={[st.sectionCard, !section.is_active && st.sectionCardOff]}>
              {/* Order controls */}
              <View style={st.orderCol}>
                <TouchableOpacity
                  style={st.orderBtn}
                  onPress={() => moveSection(section.id, 'up')}
                  disabled={idx === 0}
                >
                  <ChevronUp size={14} color={idx === 0 ? Colors.border : Colors.textMuted} strokeWidth={2.5} />
                </TouchableOpacity>
                <Text style={st.orderNum}>{idx + 1}</Text>
                <TouchableOpacity
                  style={st.orderBtn}
                  onPress={() => moveSection(section.id, 'down')}
                  disabled={idx === sections.length - 1}
                >
                  <ChevronDown size={14} color={idx === sections.length - 1 ? Colors.border : Colors.textMuted} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {/* Info */}
              <View style={st.sectionInfo}>
                <Text style={st.sectionTitle} numberOfLines={1}>
                  {section.title_ar || section.title_en}
                </Text>
                {section.title_en ? (
                  <Text style={st.sectionSub} numberOfLines={1}>{section.title_en}</Text>
                ) : null}
              </View>

              {/* Active toggle */}
              <View style={st.toggleWrap}>
                <Text style={[st.toggleLabel, { color: section.is_active ? Colors.success : Colors.textMuted }]}>
                  {section.is_active ? 'نشط' : 'مخفي'}
                </Text>
                <Switch
                  value={section.is_active}
                  onValueChange={() => toggleActive(section)}
                  trackColor={{ false: Colors.border, true: Colors.neonBlue + '88' }}
                  thumbColor={section.is_active ? Colors.neonBlue : Colors.textMuted}
                />
              </View>

              {/* Action buttons */}
              <View style={st.actionBtns}>
                <TouchableOpacity
                  style={[st.iconBtn, st.iconBtnBlue]}
                  onPress={() => openProductsPanel(section)}
                  activeOpacity={0.75}
                >
                  <Package size={14} color={Colors.neonBlue} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={st.iconBtn}
                  onPress={() => openEdit(section)}
                  activeOpacity={0.75}
                >
                  <Pencil size={14} color={Colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.iconBtn, st.iconBtnDanger]}
                  onPress={() => setDeleteId(section.id)}
                  activeOpacity={0.75}
                >
                  <Trash2 size={14} color={Colors.error} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Add / Edit modal ── */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => !saving && setModalVisible(false)}
      >
        <View style={st.overlay}>
          <View style={st.modalBox}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>{editingSection ? 'تعديل القسم' : 'قسم جديد'}</Text>
              {!saving && (
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <X size={18} color={Colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>

            <View style={st.field}>
              <Text style={st.fieldLabel}>العنوان بالعربية</Text>
              <TextInput
                style={st.fieldInput}
                value={form.title_ar}
                onChangeText={v => setForm(f => ({ ...f, title_ar: v }))}
                placeholder="مثال: الأكثر مبيعاً"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={st.field}>
              <Text style={st.fieldLabel}>العنوان بالإنجليزية</Text>
              <TextInput
                style={st.fieldInput}
                value={form.title_en}
                onChangeText={v => setForm(f => ({ ...f, title_en: v }))}
                placeholder="e.g. Best Sellers"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={st.switchRow}>
              <Text style={st.switchLabel}>تفعيل القسم</Text>
              <Switch
                value={form.is_active}
                onValueChange={v => setForm(f => ({ ...f, is_active: v }))}
                trackColor={{ true: Colors.neonBlue, false: Colors.border }}
                thumbColor={form.is_active ? '#fff' : Colors.textMuted}
              />
            </View>

            {formError ? (
              <View style={st.errorBanner}>
                <Text style={st.errorText}>{formError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[st.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color={Colors.background} size="small" />
                : <Text style={st.saveBtnText}>{editingSection ? 'حفظ التعديلات' : 'إنشاء القسم'}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Delete confirm modal ── */}
      <Modal
        visible={!!deleteId}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteId(null)}
      >
        <View style={st.overlay}>
          <View style={st.confirmBox}>
            <Text style={st.confirmTitle}>حذف القسم؟</Text>
            <Text style={st.confirmBody}>سيتم حذف القسم وجميع المنتجات المرتبطة به. لا يمكن التراجع.</Text>
            <View style={st.confirmBtns}>
              <TouchableOpacity style={st.cancelBtn} onPress={() => setDeleteId(null)} activeOpacity={0.75}>
                <Text style={st.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={st.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
                <Text style={st.deleteBtnText}>حذف</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Products panel modal ── */}
      <Modal
        visible={productPanelVisible}
        animationType="slide"
        transparent
        onRequestClose={closeProductsPanel}
      >
        <View style={st.overlay}>
          <View style={[st.modalBox, st.productsBox]}>
            <View style={st.modalHeader}>
              <View style={st.modalHeaderLeft}>
                <Package size={16} color={Colors.neonBlue} strokeWidth={2} />
                <Text style={st.modalTitle} numberOfLines={1}>
                  {activeSection
                    ? (activeSection.title_ar || activeSection.title_en)
                    : 'منتجات القسم'}
                </Text>
                <View style={st.countBadge}>
                  <Text style={st.countText}>{sectionProducts.length}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeProductsPanel}>
                <X size={18} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Selected products strip */}
            {sectionProducts.length > 0 && (
              <View style={st.selectedWrap}>
                <Text style={st.selectedLabel}>المنتجات المختارة بالترتيب:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.selectedRow}>
                  {sectionProducts.map((sp, idx) => {
                    const product = allProducts.find(p => p.id === sp.product_id);
                    if (!product) return null;
                    return (
                      <View key={sp.id} style={st.selectedChip}>
                        <Image source={{ uri: getProductImage(product) }} style={st.chipImg} />
                        <Text style={st.chipName} numberOfLines={1}>{getProductName(product, language)}</Text>
                        <View style={st.chipOrderBtns}>
                          <TouchableOpacity onPress={() => moveProduct(sp.product_id, 'up')} disabled={idx === 0}>
                            <ChevronUp size={10} color={idx === 0 ? Colors.border : Colors.textMuted} strokeWidth={2.5} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => moveProduct(sp.product_id, 'down')} disabled={idx === sectionProducts.length - 1}>
                            <ChevronDown size={10} color={idx === sectionProducts.length - 1 ? Colors.border : Colors.textMuted} strokeWidth={2.5} />
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={() => toggleProduct(product)} style={st.chipRemove}>
                          <X size={10} color={Colors.error} strokeWidth={2.5} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Search */}
            <View style={st.searchWrap}>
              <Search size={14} color={Colors.textMuted} strokeWidth={2} />
              <TextInput
                style={st.searchInput}
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder="ابحث عن منتج…"
                placeholderTextColor={Colors.textMuted}
              />
              {productSearch !== '' && (
                <TouchableOpacity onPress={() => setProductSearch('')}>
                  <X size={13} color={Colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>

            {/* Products list */}
            {loadingProducts ? (
              <View style={st.center}>
                <ActivityIndicator color={Colors.neonBlue} />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 16 }}>
                {filteredProducts.length === 0 ? (
                  <View style={st.center}>
                    <Text style={st.emptySubtitle}>لا توجد منتجات مطابقة</Text>
                  </View>
                ) : filteredProducts.map(product => {
                  const selected = isProductInSection(product.id);
                  return (
                    <TouchableOpacity
                      key={product.id}
                      style={[st.productRow, selected && st.productRowSelected]}
                      onPress={() => toggleProduct(product)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: getProductImage(product) }} style={st.productThumb} />
                      <View style={st.productInfo}>
                        <Text style={st.productName} numberOfLines={1}>
                          {getProductName(product, language)}
                        </Text>
                        <Text style={st.productMeta}>
                          {product.price?.toLocaleString()} IQD
                          {product.status === 'draft' ? ' · مسودة' : ''}
                          {product.stock === 0 ? ' · نفذت' : ''}
                        </Text>
                      </View>
                      <View style={[st.checkCircle, selected && st.checkOn]}>
                        {selected && <Check size={11} color="#fff" strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: { flex: 1, gap: Spacing.md },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800' },
  countBadge: { backgroundColor: Colors.neonBlueGlow, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: Colors.neonBlueBorder },
  countText: { color: Colors.neonBlue, fontSize: 11, fontWeight: '800' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18, marginTop: -4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.neonBlue, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2 },
  addBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '700' },

  // State
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: 60 },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', maxWidth: 320, lineHeight: 20 },

  // Section card
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  sectionCardOff: { opacity: 0.55 },
  orderCol: { alignItems: 'center', gap: 2, width: 26 },
  orderBtn: { padding: 3 },
  orderNum: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', minWidth: 18, textAlign: 'center' },
  sectionInfo: { flex: 1, gap: 2 },
  sectionTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  sectionSub: { color: Colors.textMuted, fontSize: FontSize.xs },
  toggleWrap: { alignItems: 'center', gap: 2 },
  toggleLabel: { fontSize: 9, fontWeight: '700' },
  actionBtns: { flexDirection: 'row', gap: 5 },
  iconBtn: {
    width: 32, height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnBlue: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlueBorder },
  iconBtnDanger: { backgroundColor: Colors.error + '18', borderColor: Colors.error + '40' },

  // Modal shared
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalBox: { backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, width: '100%', maxWidth: 480, gap: Spacing.md },
  productsBox: { maxWidth: 540, maxHeight: '90%', gap: Spacing.sm },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  modalTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800' },

  // Form
  field: { gap: 5 },
  fieldLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { backgroundColor: Colors.backgroundInput ?? Colors.backgroundCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, color: Colors.textPrimary, fontSize: FontSize.md },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.backgroundCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  switchLabel: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600' },
  errorBanner: { backgroundColor: Colors.error + '18', borderWidth: 1, borderColor: Colors.error + '40', borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  errorText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
  saveBtn: { backgroundColor: Colors.neonBlue, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: '800' },

  // Delete confirm
  confirmBox: { backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xl, width: '100%', maxWidth: 360, gap: Spacing.md, alignItems: 'center' },
  confirmTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800', textAlign: 'center' },
  confirmBody: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  confirmBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  cancelBtn: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '700' },
  deleteBtn: { flex: 1, backgroundColor: Colors.error, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  deleteBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },

  // Products panel
  selectedWrap: { gap: 6 },
  selectedLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  selectedRow: { gap: 8, paddingVertical: 4 },
  selectedChip: { backgroundColor: Colors.backgroundCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.neonBlueBorder, padding: 6, alignItems: 'center', gap: 3, width: 76 },
  chipImg: { width: 42, height: 42, borderRadius: 8 },
  chipName: { color: Colors.textPrimary, fontSize: 7, fontWeight: '600', textAlign: 'center', width: '100%' },
  chipOrderBtns: { flexDirection: 'row', gap: 6 },
  chipRemove: { padding: 2 },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.backgroundCard, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.sm, padding: 0 },

  productRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundCard },
  productRowSelected: { borderColor: Colors.neonBlueBorder, backgroundColor: Colors.neonBlueGlow },
  productThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.backgroundSecondary },
  productInfo: { flex: 1, gap: 3 },
  productName: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '600' },
  productMeta: { color: Colors.textMuted, fontSize: 10 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  checkOn: { backgroundColor: Colors.neonBlue, borderColor: Colors.neonBlue },
});
