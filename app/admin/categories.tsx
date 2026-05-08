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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Pencil, Trash2, X, Layers, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Globe, ArrowUp, ArrowDown } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import MobileUnsupported from '@/components/admin/MobileUnsupported';
import Toast from '@/components/admin/Toast';
import ImageUploader from '@/components/admin/ImageUploader';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { supabase, adminSupabase, Category } from '@/lib/supabase';
import { autoTranslate } from '@/lib/translate';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

type LangCode = 'en' | 'ar' | 'es' | 'de' | 'ru';

const LANG_TABS: { code: LangCode; label: string; rtl: boolean }[] = [
  { code: 'en', label: 'EN – English', rtl: false },
  { code: 'ar', label: 'AR – العربية', rtl: true },
  { code: 'es', label: 'ES – Español', rtl: false },
  { code: 'de', label: 'DE – Deutsch', rtl: false },
  { code: 'ru', label: 'RU – Русский', rtl: false },
];

type TranslationMap = Record<LangCode, { name: string; description: string }>;

const EMPTY_TRANS: TranslationMap = {
  en: { name: '', description: '' },
  ar: { name: '', description: '' },
  es: { name: '', description: '' },
  de: { name: '', description: '' },
  ru: { name: '', description: '' },
};

type CategoryRow = Category & { id: string; slug: string; active: boolean };

function CategoriesScreen() {
  const { isAdminAuthenticated } = useAdmin();
  const { t } = useLanguage();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [slug, setSlug] = useState('');
  const [active, setActive] = useState(true);
  const [iconUrl, setIconUrl] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [langTab, setLangTab] = useState<LangCode>('en');
  const [translations, setTranslations] = useState<TranslationMap>(EMPTY_TRANS);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
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
    fetchCategories();
  }, [isAdminAuthenticated]);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*, translation:category_translations!left(*)')
      .order('sort_order', { ascending: true })
      .order('slug', { ascending: true });
    setCategories((data ?? []) as CategoryRow[]);
    setLoading(false);
  };

  const openAdd = () => {
    setEditing(null);
    setSlug('');
    setActive(true);
    setIconUrl('');
    setSortOrder(String(categories.length));
    setLangTab('en');
    setTranslations(EMPTY_TRANS);
    setModalVisible(true);
  };

  const openEdit = async (cat: CategoryRow) => {
    setEditing(cat);
    setSlug(cat.slug);
    setActive(cat.active);
    setIconUrl((cat as any).icon_url ?? '');
    setSortOrder(String((cat as any).sort_order ?? 0));
    setLangTab('en');

    const { data: rows } = await supabase
      .from('category_translations')
      .select('language, name, description')
      .eq('category_id', cat.id);

    // Auto-fill missing translations from English so all tabs have content
    const enRow = rows?.find((r: any) => r.language === 'en');
    const enName = enRow?.name ?? cat.slug;
    const enDesc = enRow?.description ?? '';
    const map: TranslationMap = { ...EMPTY_TRANS };
    for (const row of rows ?? []) {
      const lang = row.language as LangCode;
      if (lang in map) map[lang] = { name: row.name ?? '', description: row.description ?? '' };
    }
    // Fill empty non-English slots from English
    for (const lang of ['ar', 'es', 'de', 'ru'] as LangCode[]) {
      if (!map[lang].name) map[lang] = { name: enName, description: enDesc };
    }
    setTranslations(map);
    setModalVisible(true);
  };

  const setTrans = (lang: LangCode, field: 'name' | 'description', value: string) => {
    setTranslations((prev) => ({ ...prev, [lang]: { ...prev[lang], [field]: value } }));
  };

  const validate = (): string | null => {
    if (!slug.trim()) return t.slugRequired;
    if (!/^[a-z0-9-]+$/.test(slug.trim())) return t.slugInvalid;
    if (!translations.en.name.trim()) return t.englishNameRequired;
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { showToast(err, 'error'); return; }
    setSaving(true);

    const db = adminSupabase();
    let categoryId: string;

    const sortNum = parseInt(sortOrder, 10);
    const finalSort = isNaN(sortNum) ? 0 : Math.max(0, sortNum);

    if (editing) {
      const { error } = await db
        .from('categories')
        .update({ slug: slug.trim(), active, icon_url: iconUrl.trim(), sort_order: finalSort, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
      if (error) { showToast('Save failed: ' + error.message, 'error'); setSaving(false); return; }
      categoryId = editing.id;
    } else {
      const { data: newCat, error } = await db
        .from('categories')
        .insert({ slug: slug.trim(), active, icon_url: iconUrl.trim(), sort_order: finalSort })
        .select()
        .maybeSingle();
      if (error || !newCat) { showToast('Save failed: ' + (error?.message ?? 'Unknown'), 'error'); setSaving(false); return; }
      categoryId = newCat.id;
    }

    // Upsert translations for all languages, falling back to English for empty slots
    const enName = translations.en.name.trim() || slug.trim();
    const enDesc = translations.en.description.trim();
    await Promise.all(
      (Object.entries(translations) as [LangCode, { name: string; description: string }][]).map(
        async ([lang, { name, description }]) => {
          const finalName = name.trim() || enName;
          const finalDesc = description.trim() || enDesc;

          await db.from('category_translations').upsert(
            {
              category_id: categoryId,
              language: lang,
              name: finalName,
              description: finalDesc,
            },
            { onConflict: 'category_id,language' }
          );
        }
      )
    );

    await fetchCategories();
    setSaving(false);
    setModalVisible(false);
    showToast(editing ? t.categoryUpdated : t.categoryCreated);
  };

  const handleDelete = async (id: string) => {
    await adminSupabase().from('categories').delete().eq('id', id);
    setDeleteId(null);
    await fetchCategories();
    showToast(t.categoryDeleted);
  };

  const handleAutoTranslate = async () => {
    if (!translations.en.name.trim()) { showToast(t.englishNameRequired, 'error'); return; }
    setTranslating(true);
    try {
      const result = await autoTranslate({
        name: translations.en.name.trim(),
        description: translations.en.description.trim(),
      });
      setTranslations((prev) => ({
        ...prev,
        ar: { name: result.ar?.name || prev.ar.name, description: result.ar?.description || prev.ar.description },
        es: { name: result.es?.name || prev.es.name, description: result.es?.description || prev.es.description },
        de: { name: result.de?.name || prev.de.name, description: result.de?.description || prev.de.description },
        ru: { name: result.ru?.name || prev.ru.name, description: result.ru?.description || prev.ru.description },
      }));
      showToast(t.translationDone ?? 'Translations applied');
    } catch {
      showToast(t.translationFailed ?? 'Auto-translate failed', 'error');
    } finally {
      setTranslating(false);
    }
  };

  const hasTrans = (lang: LangCode) => !!translations[lang].name.trim();

  if (loading) {
    return (
      <AdminWebDashboard title={t.categories}>
        <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 60 }} />
      </AdminWebDashboard>
    );
  }

  return (
    <AdminWebDashboard title={t.categories}>
      <View style={styles.container}>
        <View style={styles.toolbar}>
          <Text style={styles.countText}>{categories.length} {t.categoriesCount}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
            <Plus size={16} color={Colors.background} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>{t.addCategory}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { width: 44 }]}>Icon</Text>
          <Text style={[styles.th, { flex: 1 }]}>{t.colSlug}</Text>
          <Text style={[styles.th, { flex: 2 }]}>{t.colEnglishName}</Text>
          <Text style={[styles.th, { flex: 2 }]}>{t.colArabicName}</Text>
          <Text style={[styles.th, { width: 52, textAlign: 'center' }]}>Order</Text>
          <Text style={[styles.th, { width: 76 }]}>{t.colStatus}</Text>
          <Text style={[styles.th, { width: 80, textAlign: 'center' }]}>{t.colActions}</Text>
        </View>

        {categories.map((cat) => {
          const transArr: any[] = Array.isArray(cat.translation) ? cat.translation : (cat.translation ? [cat.translation] : []);
          const enTrans = transArr.find((t: any) => t.language === 'en');
          const arTrans = transArr.find((t: any) => t.language === 'ar');
          return (
            <View key={cat.id} style={styles.tableRow}>
              {/* Icon thumbnail */}
              <View style={{ width: 44, alignItems: 'center' }}>
                {(cat as any).icon_url ? (
                  <Image source={{ uri: (cat as any).icon_url }} style={styles.iconThumb} />
                ) : (
                  <View style={styles.iconThumbEmpty}>
                    <Layers size={14} color={Colors.textMuted} strokeWidth={1.5} />
                  </View>
                )}
              </View>
              <View style={[styles.slugCell, { flex: 1 }]}>
                <Text style={styles.slugText}>{cat.slug}</Text>
              </View>
              <Text style={[styles.nameText, { flex: 2 }]} numberOfLines={1}>
                {enTrans?.name ?? '—'}
              </Text>
              <Text style={[styles.nameText, styles.rtlText, { flex: 2 }]} numberOfLines={1}>
                {arTrans?.name ?? '—'}
              </Text>
              <Text style={[styles.nameText, { width: 52, textAlign: 'center' }]}>
                {(cat as any).sort_order ?? 0}
              </Text>
              <View style={{ width: 76 }}>
                <View style={[styles.statusBadge, { backgroundColor: cat.active ? Colors.success + '22' : Colors.error + '22', borderColor: cat.active ? Colors.success + '44' : Colors.error + '44' }]}>
                  <Text style={[styles.statusText, { color: cat.active ? Colors.success : Colors.error }]}>
                    {cat.active ? t.active : t.hidden}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(cat)} activeOpacity={0.7}>
                  <Pencil size={14} color={Colors.neonBlue} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteId(cat.id)} activeOpacity={0.7}>
                  <Trash2 size={14} color={Colors.error} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {categories.length === 0 && (
          <View style={styles.emptyState}>
            <Layers size={48} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>{t.noCategoriesYet}</Text>
            <Text style={styles.emptySubtitle}>{t.addFirstCategory}</Text>
          </View>
        )}
      </View>

      {/* Add / Edit modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? t.editCategory : t.addCategory}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Slug + Active */}
              <Text style={styles.fieldLabel}>{t.slugLabel}</Text>
              <TextInput
                style={[styles.input, editing && styles.inputDisabled]}
                value={slug}
                onChangeText={(v) => setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder={t.slugPlaceholder}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!editing}
              />
              {editing && <Text style={styles.hintText}>{t.slugHint}</Text>}

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t.visibleInStore}</Text>
                <Switch
                  value={active}
                  onValueChange={setActive}
                  trackColor={{ true: Colors.success, false: Colors.border }}
                  thumbColor={Colors.white}
                />
              </View>

              {/* Icon / image upload */}
              <Text style={styles.fieldLabel}>Category Icon</Text>
              <ImageUploader
                value={iconUrl}
                onChange={setIconUrl}
                folder="general"
                label="Category Icon"
                hint="Shown as round icon on homepage. Square image works best."
                previewHeight={80}
                compact
                allowUrl
              />

              {/* Sort order */}
              <Text style={styles.fieldLabel}>Display Order</Text>
              <TextInput
                style={styles.input}
                value={sortOrder}
                onChangeText={setSortOrder}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
              <Text style={styles.hintText}>Lower number = shown first on homepage.</Text>

              {/* Language tabs */}
              <View style={styles.langTabs}>
                {LANG_TABS.map((l) => {
                  const complete = hasTrans(l.code) || (l.code === 'en' && !!translations.en.name.trim());
                  const isActive = langTab === l.code;
                  return (
                    <TouchableOpacity
                      key={l.code}
                      style={[styles.langTab, isActive && styles.langTabActive]}
                      onPress={() => setLangTab(l.code)}
                      activeOpacity={0.7}
                    >
                      {l.code !== 'en' && !hasTrans(l.code) ? (
                        <AlertCircle size={11} color={Colors.warning} strokeWidth={2} />
                      ) : l.code !== 'en' && hasTrans(l.code) ? (
                        <CheckCircle size={11} color={Colors.success} strokeWidth={2} />
                      ) : null}
                      <Text style={[styles.langTabText, isActive && styles.langTabTextActive]}>
                        {l.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Translation fields for active lang */}
              {LANG_TABS.map((l) => langTab !== l.code ? null : (
                <View key={l.code}>
                  <Text style={styles.fieldLabel}>
                    {l.code === 'en' ? t.nameRequired : t.nameLabel}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={translations[l.code].name}
                    onChangeText={(v) => setTrans(l.code, 'name', v)}
                    placeholder={l.code === 'ar' ? 'مثال: الخوذات' : l.code === 'es' ? 'ej. Cascos' : l.code === 'de' ? 'z.B. Helme' : 'e.g. Helmets'}
                    placeholderTextColor={Colors.textMuted}
                    textAlign={l.rtl ? 'right' : 'left'}
                  />
                  <Text style={styles.fieldLabel}>{t.descriptionField}</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={translations[l.code].description}
                    onChangeText={(v) => setTrans(l.code, 'description', v)}
                    placeholder={l.code === 'ar' ? 'وصف مختصر' : 'Short description'}
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    textAlignVertical="top"
                    textAlign={l.rtl ? 'right' : 'left'}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.translateBtn, (translating || saving) && { opacity: 0.6 }]}
                onPress={handleAutoTranslate}
                disabled={translating || saving}
                activeOpacity={0.8}
              >
                {translating
                  ? <ActivityIndicator color={Colors.neonBlue} size="small" />
                  : <><Globe size={14} color={Colors.neonBlue} strokeWidth={2} /><Text style={styles.translateBtnText}>{t.autoTranslate ?? 'Auto-Translate'}</Text></>
                }
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, (saving || translating) && { opacity: 0.7 }]} onPress={handleSave} disabled={saving || translating}>
                {saving
                  ? <ActivityIndicator color={Colors.background} size="small" />
                  : <Text style={styles.saveBtnText}>{editing ? t.updateCategory : t.createCategory}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete confirm */}
      <Modal visible={!!deleteId} transparent animationType="fade" onRequestClose={() => setDeleteId(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { maxWidth: 360 }]}>
            <Text style={[styles.modalTitle, { padding: Spacing.lg }]}>{t.deleteCategory}</Text>
            <Text style={[styles.hintText, { paddingHorizontal: Spacing.lg, color: Colors.warning }]}>
              {t.deleteCategoryWarning}
            </Text>
            <View style={[styles.modalFooter, { borderTopWidth: 1, borderTopColor: Colors.border }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteId(null)}>
                <Text style={styles.cancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: Colors.error }]}
                onPress={() => deleteId && handleDelete(deleteId)}
              >
                <Text style={styles.saveBtnText}>{t.delete}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast visible={!!toast} message={toast?.message ?? ''} type={toast?.type} />
    </AdminWebDashboard>
  );
}

function MobileCategoriesScreen() {
  const { t } = useLanguage();
  return (
    <AdminMobileDashboard title={t.categories} showBack>
      <MobileUnsupported featureName="Category Management" />
    </AdminMobileDashboard>
  );
}

export default function CategoriesScreenGuarded() {
  const { isMobile } = useAdminLayout();
  if (isMobile) return <MobileCategoriesScreen />;
  return (
    <AdminGuard permission="manage_products">
      <CategoriesScreen />
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  countText: { color: Colors.textMuted, fontSize: FontSize.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.neonBlue, borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 40 },
  addBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '700' },

  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.sm, marginBottom: 4 },
  th: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.md, backgroundColor: Colors.backgroundCard, borderRadius: Radius.md, marginBottom: 4, borderWidth: 1, borderColor: Colors.border },
  slugCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slugText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', fontFamily: 'monospace' },
  nameText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '500' },
  rtlText: { textAlign: 'right' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, alignSelf: 'flex-start' },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  actions: { width: 80, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  editBtn: { width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: Colors.neonBlueGlow, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: Colors.errorDim, justifyContent: 'center', alignItems: 'center' },
  iconThumb: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.backgroundCard },
  iconThumbEmpty: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '700' },
  emptySubtitle: { color: Colors.textMuted, fontSize: FontSize.md },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.md },
  modalCard: { backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.xl, width: '100%', maxWidth: 540, maxHeight: '90%', borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800' },
  modalBody: { padding: Spacing.lg, maxHeight: 480 },
  modalFooter: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg },

  fieldLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: Spacing.sm },
  input: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, color: Colors.textPrimary, fontSize: FontSize.md, marginBottom: 2 },
  inputDisabled: { opacity: 0.5 },
  inputMultiline: { height: 72, textAlignVertical: 'top', paddingTop: 10 },
  hintText: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: Spacing.sm, marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: Spacing.sm },
  switchLabel: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '600' },

  langTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.md, marginBottom: Spacing.sm },
  langTab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  langTabActive: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlueBorder },
  langTabText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  langTabTextActive: { color: Colors.neonBlue },

  cancelBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  saveBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.neonBlue, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: Colors.background, fontSize: FontSize.md, fontWeight: '800' },
  translateBtn: { flex: 1, height: 46, borderRadius: Radius.md, backgroundColor: Colors.neonBlueGlow, borderWidth: 1, borderColor: Colors.neonBlueBorder, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 },
  translateBtnText: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '700' },
});
