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
import { Plus, Pencil, Trash2, X, Layers, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Globe, RotateCcw, ChevronRight, Tag } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { usePermissions } from '@/hooks/usePermissions';
import { logAdminAction } from '@/lib/auditLog';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import MobileUnsupported from '@/components/admin/MobileUnsupported';
import Toast from '@/components/admin/Toast';
import ImageUploader from '@/components/admin/ImageUploader';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { supabase, adminSupabase, Category, Subcategory } from '@/lib/supabase';
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

// ─── Subcategory management modal ────────────────────────────────────────────

type SubRow = Subcategory & { enName?: string; arName?: string };

type SubFormState = {
  slug: string;
  is_active: boolean;
  icon_url: string;
  display_order: string;
  translations: TranslationMap;
};

const EMPTY_SUB_FORM: SubFormState = {
  slug: '',
  is_active: true,
  icon_url: '',
  display_order: '0',
  translations: { ...EMPTY_TRANS },
};

function SubcategoryModal({
  category,
  onClose,
  adminEmail,
  adminId,
  adminName,
  adminRole,
}: {
  category: CategoryRow;
  onClose: () => void;
  adminEmail: string;
  adminId: string;
  adminName: string;
  adminRole: string;
}) {
  const { t } = useLanguage();
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SubRow | null>(null);
  const [form, setForm] = useState<SubFormState>(EMPTY_SUB_FORM);
  const [langTab, setLangTab] = useState<LangCode>('en');
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const fetchSubs = async () => {
    setLoading(true);
    const db = adminSupabase();
    const { data } = await db
      .from('subcategories')
      .select('*, translation:subcategory_translations!left(*)')
      .eq('category_id', category.id)
      .eq('is_deleted', false)
      .order('display_order', { ascending: true });

    const rows: SubRow[] = (data ?? []).map((row: any) => {
      const transArr: any[] = Array.isArray(row.translation) ? row.translation : row.translation ? [row.translation] : [];
      return {
        ...row,
        enName: transArr.find((t: any) => t.language === 'en')?.name ?? row.slug,
        arName: transArr.find((t: any) => t.language === 'ar')?.name ?? '',
      };
    });
    setSubs(rows);
    setLoading(false);
  };

  useEffect(() => { fetchSubs(); }, []);

  const catTransArr: any[] = Array.isArray(category.translation)
    ? category.translation
    : category.translation ? [category.translation] : [];
  const catName = catTransArr.find((t: any) => t.language === 'en')?.name ?? category.slug;

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_SUB_FORM, display_order: String(subs.length), translations: { en: { name: '', description: '' }, ar: { name: '', description: '' }, es: { name: '', description: '' }, de: { name: '', description: '' }, ru: { name: '', description: '' } } });
    setLangTab('en');
    setShowForm(true);
  };

  const openEdit = async (sub: SubRow) => {
    setEditing(sub);
    const { data: rows } = await supabase
      .from('subcategory_translations')
      .select('language, name, description')
      .eq('subcategory_id', sub.id);

    const map: TranslationMap = { ...EMPTY_TRANS };
    for (const row of rows ?? []) {
      const lang = row.language as LangCode;
      if (lang in map) map[lang] = { name: row.name ?? '', description: row.description ?? '' };
    }
    const enName = map.en.name || sub.slug;
    const enDesc = map.en.description;
    for (const lang of ['ar', 'es', 'de', 'ru'] as LangCode[]) {
      if (!map[lang].name) map[lang] = { name: enName, description: enDesc };
    }
    setForm({
      slug: sub.slug,
      is_active: sub.is_active,
      icon_url: sub.icon_url ?? '',
      display_order: String(sub.display_order ?? 0),
      translations: map,
    });
    setLangTab('en');
    setShowForm(true);
  };

  const setTrans = (lang: LangCode, field: 'name' | 'description', value: string) => {
    setForm((prev) => ({ ...prev, translations: { ...prev.translations, [lang]: { ...prev.translations[lang], [field]: value } } }));
  };

  const handleAutoTranslate = async () => {
    if (!form.translations.en.name.trim()) { showToast('Enter English name first', 'error'); return; }
    setTranslating(true);
    try {
      const result = await autoTranslate({ name: form.translations.en.name.trim(), description: form.translations.en.description.trim() });
      setForm((prev) => ({
        ...prev,
        translations: {
          ...prev.translations,
          ar: { name: result.ar?.name || prev.translations.ar.name, description: result.ar?.description || prev.translations.ar.description },
          es: { name: result.es?.name || prev.translations.es.name, description: result.es?.description || prev.translations.es.description },
          de: { name: result.de?.name || prev.translations.de.name, description: result.de?.description || prev.translations.de.description },
          ru: { name: result.ru?.name || prev.translations.ru.name, description: result.ru?.description || prev.translations.ru.description },
        },
      }));
      showToast((t as any).translationDone ?? 'Translations applied');
    } catch {
      showToast((t as any).translationFailed ?? 'Auto-translate failed', 'error');
    } finally {
      setTranslating(false);
    }
  };

  const handleSave = async () => {
    if (!form.slug.trim()) { showToast('Slug required', 'error'); return; }
    if (!/^[a-z0-9-]+$/.test(form.slug.trim())) { showToast('Slug must be lowercase letters, numbers, hyphens', 'error'); return; }
    if (!form.translations.en.name.trim()) { showToast('English name required', 'error'); return; }
    setSaving(true);
    const db = adminSupabase();
    const displayNum = parseInt(form.display_order, 10);
    const finalOrder = isNaN(displayNum) ? 0 : Math.max(0, displayNum);
    let subId: string;

    if (editing) {
      const { error } = await db.from('subcategories').update({
        slug: form.slug.trim(),
        is_active: form.is_active,
        icon_url: form.icon_url.trim(),
        display_order: finalOrder,
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id);
      if (error) { showToast('Save failed: ' + error.message, 'error'); setSaving(false); return; }
      subId = editing.id;
    } else {
      const { data: newSub, error } = await db.from('subcategories').insert({
        category_id: category.id,
        slug: form.slug.trim(),
        is_active: form.is_active,
        icon_url: form.icon_url.trim(),
        display_order: finalOrder,
      }).select().maybeSingle();
      if (error || !newSub) { showToast('Save failed: ' + (error?.message ?? 'Unknown'), 'error'); setSaving(false); return; }
      subId = newSub.id;
    }

    const enName = form.translations.en.name.trim() || form.slug.trim();
    const enDesc = form.translations.en.description.trim();
    await Promise.all(
      (Object.entries(form.translations) as [LangCode, { name: string; description: string }][]).map(([lang, { name, description }]) =>
        db.from('subcategory_translations').upsert({
          subcategory_id: subId,
          language: lang,
          name: name.trim() || enName,
          description: description.trim() || enDesc,
        }, { onConflict: 'subcategory_id,language' })
      )
    );

    await fetchSubs();
    setSaving(false);
    setShowForm(false);
    showToast(editing ? (t as any).subcategoryUpdated ?? 'Updated' : (t as any).subcategoryCreated ?? 'Created');
    logAdminAction({ action: editing ? 'update' : 'create', entityType: 'subcategory', entityId: subId, entityLabel: form.slug, adminUserId: adminId, adminEmail, adminName, adminRole });
  };

  const handleDelete = async (id: string) => {
    const sub = subs.find((s) => s.id === id);
    await adminSupabase().from('subcategories').update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: adminEmail,
    }).eq('id', id);
    setDeleteId(null);
    await fetchSubs();
    showToast((t as any).subcategoryDeleted ?? 'Deleted');
    logAdminAction({ action: 'delete', entityType: 'subcategory', entityId: id, entityLabel: sub?.slug, adminUserId: adminId, adminEmail, adminName, adminRole });
  };

  const hasTrans = (lang: LangCode) => !!form.translations[lang].name.trim();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={subStyles.overlay}>
        <View style={subStyles.panel}>
          {/* Header */}
          <View style={subStyles.panelHeader}>
            <View style={{ flex: 1 }}>
              <Text style={subStyles.panelTitle}>{(t as any).manageSubcategories ?? 'Manage Subcategories'}</Text>
              <Text style={subStyles.panelSub}>{catName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Toast */}
          {toast && (
            <View style={[subStyles.inlineToast, toast.type === 'error' && subStyles.inlineToastError]}>
              <Text style={[subStyles.inlineToastText, toast.type === 'error' && { color: Colors.error }]}>{toast.message}</Text>
            </View>
          )}

          {/* Sub list */}
          <ScrollView style={subStyles.listArea} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 32 }} />
            ) : subs.length === 0 ? (
              <View style={subStyles.empty}>
                <Tag size={36} color={Colors.textMuted} strokeWidth={1.5} />
                <Text style={subStyles.emptyTitle}>{(t as any).noSubcategoriesYet ?? 'No subcategories yet'}</Text>
                <Text style={subStyles.emptySub}>{(t as any).addFirstSubcategory ?? 'Add subcategories to help customers browse'}</Text>
              </View>
            ) : (
              subs.map((sub) => (
                <View key={sub.id} style={subStyles.subRow}>
                  <View style={subStyles.subInfo}>
                    <Text style={subStyles.subName}>{sub.enName}</Text>
                    <Text style={subStyles.subMeta}>{sub.arName} · {sub.slug} · #{sub.display_order}</Text>
                  </View>
                  <View style={[subStyles.statusPill, { backgroundColor: sub.is_active ? Colors.success + '22' : Colors.error + '22', borderColor: sub.is_active ? Colors.success + '55' : Colors.error + '55' }]}>
                    <Text style={[subStyles.statusPillText, { color: sub.is_active ? Colors.success : Colors.error }]}>{sub.is_active ? 'Active' : 'Hidden'}</Text>
                  </View>
                  <TouchableOpacity style={subStyles.subEditBtn} onPress={() => openEdit(sub)} activeOpacity={0.7}>
                    <Pencil size={13} color={Colors.neonBlue} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity style={subStyles.subDeleteBtn} onPress={() => setDeleteId(sub.id)} activeOpacity={0.7}>
                    <Trash2 size={13} color={Colors.error} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          {/* Add button */}
          {!showForm && (
            <View style={subStyles.panelFooter}>
              <TouchableOpacity style={subStyles.addBtn} onPress={openAdd} activeOpacity={0.8}>
                <Plus size={15} color={Colors.background} strokeWidth={2.5} />
                <Text style={subStyles.addBtnText}>{(t as any).addSubcategory ?? 'Add Subcategory'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Inline form */}
          {showForm && (
            <View style={subStyles.formArea}>
              <View style={subStyles.formHeader}>
                <Text style={subStyles.formTitle}>{editing ? (t as any).editSubcategory ?? 'Edit Subcategory' : (t as any).addSubcategory ?? 'Add Subcategory'}</Text>
                <TouchableOpacity onPress={() => setShowForm(false)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <X size={16} color={Colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                <Text style={subStyles.fieldLabel}>Slug *</Text>
                <TextInput
                  style={[subStyles.input, editing && { opacity: 0.5 }]}
                  value={form.slug}
                  onChangeText={(v) => setForm((p) => ({ ...p, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                  placeholder="e.g. face-makeup"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  editable={!editing}
                />
                <View style={subStyles.switchRow}>
                  <Text style={subStyles.switchLabel}>Visible in store</Text>
                  <Switch value={form.is_active} onValueChange={(v) => setForm((p) => ({ ...p, is_active: v }))} trackColor={{ true: Colors.success, false: Colors.border }} thumbColor={Colors.white} />
                </View>
                <Text style={subStyles.fieldLabel}>Display Order</Text>
                <TextInput
                  style={subStyles.input}
                  value={form.display_order}
                  onChangeText={(v) => setForm((p) => ({ ...p, display_order: v }))}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                />

                {/* Language tabs */}
                <View style={subStyles.langTabs}>
                  {LANG_TABS.map((l) => {
                    const active = langTab === l.code;
                    return (
                      <TouchableOpacity
                        key={l.code}
                        style={[subStyles.langTab, active && subStyles.langTabActive]}
                        onPress={() => setLangTab(l.code)}
                        activeOpacity={0.7}
                      >
                        {l.code !== 'en' && !hasTrans(l.code) && <AlertCircle size={10} color={Colors.warning} strokeWidth={2} />}
                        {l.code !== 'en' && hasTrans(l.code) && <CheckCircle size={10} color={Colors.success} strokeWidth={2} />}
                        <Text style={[subStyles.langTabText, active && subStyles.langTabTextActive]}>{l.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {LANG_TABS.map((l) => langTab !== l.code ? null : (
                  <View key={l.code}>
                    <Text style={subStyles.fieldLabel}>{l.code === 'en' ? 'Name *' : 'Name'}</Text>
                    <TextInput
                      style={subStyles.input}
                      value={form.translations[l.code].name}
                      onChangeText={(v) => setTrans(l.code, 'name', v)}
                      placeholder={l.code === 'ar' ? 'مثال: وجه' : 'e.g. Face'}
                      placeholderTextColor={Colors.textMuted}
                      textAlign={l.rtl ? 'right' : 'left'}
                    />
                    <Text style={subStyles.fieldLabel}>Description</Text>
                    <TextInput
                      style={[subStyles.input, { height: 60, textAlignVertical: 'top', paddingTop: 8 }]}
                      value={form.translations[l.code].description}
                      onChangeText={(v) => setTrans(l.code, 'description', v)}
                      placeholder={l.code === 'ar' ? 'وصف مختصر' : 'Short description'}
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      textAlign={l.rtl ? 'right' : 'left'}
                    />
                  </View>
                ))}
              </ScrollView>

              <View style={subStyles.formFooter}>
                <TouchableOpacity style={subStyles.cancelBtn} onPress={() => setShowForm(false)}>
                  <Text style={subStyles.cancelBtnText}>{(t as any).cancel ?? 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[subStyles.translateBtn, (translating || saving) && { opacity: 0.6 }]}
                  onPress={handleAutoTranslate}
                  disabled={translating || saving}
                >
                  {translating
                    ? <ActivityIndicator color={Colors.neonBlue} size="small" />
                    : <><Globe size={13} color={Colors.neonBlue} strokeWidth={2} /><Text style={subStyles.translateBtnText}>Auto-Translate</Text></>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={[subStyles.saveBtn, (saving || translating) && { opacity: 0.7 }]} onPress={handleSave} disabled={saving || translating}>
                  {saving
                    ? <ActivityIndicator color={Colors.background} size="small" />
                    : <Text style={subStyles.saveBtnText}>{editing ? (t as any).updateSubcategory ?? 'Update' : (t as any).createSubcategory ?? 'Create'}</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Delete confirm */}
      <Modal visible={!!deleteId} transparent animationType="fade" onRequestClose={() => setDeleteId(null)}>
        <View style={subStyles.overlay}>
          <View style={[subStyles.panel, { maxWidth: 360, maxHeight: undefined }]}>
            <Text style={[subStyles.panelTitle, { padding: Spacing.lg }]}>{(t as any).deleteSubcategory ?? 'Delete Subcategory?'}</Text>
            <Text style={[subStyles.emptySub, { paddingHorizontal: Spacing.lg, color: Colors.warning }]}>
              {(t as any).deleteSubcategoryWarning ?? 'This will remove the subcategory and all its translations.'}
            </Text>
            <View style={[subStyles.formFooter, { borderTopWidth: 1, borderTopColor: Colors.border }]}>
              <TouchableOpacity style={subStyles.cancelBtn} onPress={() => setDeleteId(null)}>
                <Text style={subStyles.cancelBtnText}>{(t as any).cancel ?? 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[subStyles.saveBtn, { backgroundColor: Colors.error }]} onPress={() => deleteId && handleDelete(deleteId)}>
                <Text style={subStyles.saveBtnText}>{(t as any).delete ?? 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// ─── Main categories screen ───────────────────────────────────────────────────

function CategoriesScreen() {
  const { isAdminAuthenticated, admin } = useAdmin();
  const { isSuperAdmin } = usePermissions();
  const { t } = useLanguage();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [trashedCategories, setTrashedCategories] = useState<CategoryRow[]>([]);
  const [showTrash, setShowTrash] = useState(false);
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
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null);
  const [subCatCategory, setSubCatCategory] = useState<CategoryRow | null>(null);
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
    const db = adminSupabase();
    const [activeRes, trashedRes] = await Promise.all([
      db.from('categories')
        .select('*, translation:category_translations!left(*)')
        .eq('is_deleted', false)
        .order('sort_order', { ascending: true })
        .order('slug', { ascending: true }),
      db.from('categories')
        .select('*, translation:category_translations!left(*)')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false }),
    ]);
    setCategories((activeRes.data ?? []) as CategoryRow[]);
    setTrashedCategories((trashedRes.data ?? []) as CategoryRow[]);
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

    const enRow = rows?.find((r: any) => r.language === 'en');
    const enName = enRow?.name ?? cat.slug;
    const enDesc = enRow?.description ?? '';
    const map: TranslationMap = { ...EMPTY_TRANS };
    for (const row of rows ?? []) {
      const lang = row.language as LangCode;
      if (lang in map) map[lang] = { name: row.name ?? '', description: row.description ?? '' };
    }
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

    const enName = translations.en.name.trim() || slug.trim();
    const enDesc = translations.en.description.trim();
    await Promise.all(
      (Object.entries(translations) as [LangCode, { name: string; description: string }][]).map(
        async ([lang, { name, description }]) => {
          const finalName = name.trim() || enName;
          const finalDesc = description.trim() || enDesc;
          await db.from('category_translations').upsert(
            { category_id: categoryId, language: lang, name: finalName, description: finalDesc },
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
    const cat = categories.find((c) => c.id === id);
    await adminSupabase().from('categories').update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: admin?.email ?? '',
    }).eq('id', id);
    setDeleteId(null);
    await fetchCategories();
    showToast(t.categoryDeleted);
    logAdminAction({ action: 'delete', entityType: 'category', entityId: id, entityLabel: cat?.slug, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
  };

  const handleRestore = async (id: string) => {
    await adminSupabase().from('categories').update({ is_deleted: false, deleted_at: null, deleted_by: null }).eq('id', id);
    await fetchCategories();
    showToast('Category restored');
    const cat = trashedCategories.find((c) => c.id === id);
    logAdminAction({ action: 'update', entityType: 'category', entityId: id, entityLabel: cat?.slug, metadata: { action: 'restore' }, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
  };

  const handleHardDelete = async (id: string) => {
    const cat = trashedCategories.find((c) => c.id === id);
    await adminSupabase().from('categories').delete().eq('id', id);
    setHardDeleteId(null);
    await fetchCategories();
    showToast('Category permanently deleted');
    logAdminAction({ action: 'delete', entityType: 'category', entityId: id, entityLabel: cat?.slug, metadata: { permanent: true }, adminUserId: admin?.id ?? '', adminEmail: admin?.email ?? '', adminName: admin?.name ?? '', adminRole: admin?.role ?? '' });
  };

  const handleAutoTranslate = async () => {
    if (!translations.en.name.trim()) { showToast(t.englishNameRequired, 'error'); return; }
    setTranslating(true);
    try {
      const result = await autoTranslate({ name: translations.en.name.trim(), description: translations.en.description.trim() });
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={styles.countText}>
              {showTrash ? `${trashedCategories.length} in Trash` : `${categories.length} ${t.categoriesCount}`}
            </Text>
            {isSuperAdmin && (
              <TouchableOpacity
                style={[styles.trashToggleBtn, showTrash && styles.trashToggleBtnActive]}
                onPress={() => setShowTrash(!showTrash)}
                activeOpacity={0.8}
              >
                <Trash2 size={13} color={showTrash ? Colors.error : Colors.textMuted} strokeWidth={2} />
                <Text style={[styles.trashToggleText, showTrash && { color: Colors.error }]}>
                  Trash {trashedCategories.length > 0 ? `(${trashedCategories.length})` : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {!showTrash && (
            <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
              <Plus size={16} color={Colors.background} strokeWidth={2.5} />
              <Text style={styles.addBtnText}>{t.addCategory}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { width: 44 }]}>Icon</Text>
          <Text style={[styles.th, { flex: 1 }]}>{t.colSlug}</Text>
          <Text style={[styles.th, { flex: 2 }]}>{t.colEnglishName}</Text>
          <Text style={[styles.th, { flex: 2 }]}>{t.colArabicName}</Text>
          <Text style={[styles.th, { width: 52, textAlign: 'center' }]}>Order</Text>
          <Text style={[styles.th, { width: 76 }]}>{t.colStatus}</Text>
          <Text style={[styles.th, { width: 140, textAlign: 'center' }]}>{t.colActions}</Text>
        </View>

        {(showTrash ? trashedCategories : categories).map((cat) => {
          const transArr: any[] = Array.isArray(cat.translation) ? cat.translation : (cat.translation ? [cat.translation] : []);
          const enTrans = transArr.find((t: any) => t.language === 'en');
          const arTrans = transArr.find((t: any) => t.language === 'ar');
          return (
            <View key={cat.id} style={[styles.tableRow, showTrash && { opacity: 0.75 }]}>
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
                {showTrash && (cat as any).deleted_by && (
                  <Text style={styles.deletedByText}>by {(cat as any).deleted_by}</Text>
                )}
              </View>
              <Text style={[styles.nameText, { flex: 2 }]} numberOfLines={1}>{enTrans?.name ?? '—'}</Text>
              <Text style={[styles.nameText, styles.rtlText, { flex: 2 }]} numberOfLines={1}>{arTrans?.name ?? '—'}</Text>
              <Text style={[styles.nameText, { width: 52, textAlign: 'center' }]}>
                {showTrash ? '—' : ((cat as any).sort_order ?? 0)}
              </Text>
              <View style={{ width: 76 }}>
                {showTrash ? (
                  <View style={[styles.statusBadge, { backgroundColor: Colors.error + '22', borderColor: Colors.error + '44' }]}>
                    <Text style={[styles.statusText, { color: Colors.error }]}>Deleted</Text>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, { backgroundColor: cat.active ? Colors.success + '22' : Colors.error + '22', borderColor: cat.active ? Colors.success + '44' : Colors.error + '44' }]}>
                    <Text style={[styles.statusText, { color: cat.active ? Colors.success : Colors.error }]}>
                      {cat.active ? t.active : t.hidden}
                    </Text>
                  </View>
                )}
              </View>
              <View style={[styles.actions, { width: 140 }]}>
                {showTrash ? (
                  <>
                    <TouchableOpacity style={styles.editBtn} onPress={() => handleRestore(cat.id)} activeOpacity={0.7}>
                      <RotateCcw size={14} color={Colors.success} strokeWidth={2} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => setHardDeleteId(cat.id)} activeOpacity={0.7}>
                      <Trash2 size={14} color={Colors.error} strokeWidth={2} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.subCatBtn}
                      onPress={() => setSubCatCategory(cat)}
                      activeOpacity={0.7}
                    >
                      <Tag size={12} color={Colors.gold} strokeWidth={2} />
                      <Text style={styles.subCatBtnText}>Subs</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(cat)} activeOpacity={0.7}>
                      <Pencil size={14} color={Colors.neonBlue} strokeWidth={2} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteId(cat.id)} activeOpacity={0.7}>
                      <Trash2 size={14} color={Colors.error} strokeWidth={2} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        })}

        {!showTrash && categories.length === 0 && (
          <View style={styles.emptyState}>
            <Layers size={48} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>{t.noCategoriesYet}</Text>
            <Text style={styles.emptySubtitle}>{t.addFirstCategory}</Text>
          </View>
        )}
        {showTrash && trashedCategories.length === 0 && (
          <View style={styles.emptyState}>
            <Trash2 size={48} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Trash is empty</Text>
            <Text style={styles.emptySubtitle}>Deleted categories appear here</Text>
          </View>
        )}
      </View>

      {/* Add / Edit category modal */}
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
                <Switch value={active} onValueChange={setActive} trackColor={{ true: Colors.success, false: Colors.border }} thumbColor={Colors.white} />
              </View>

              <Text style={styles.fieldLabel}>Category Icon</Text>
              <ImageUploader value={iconUrl} onChange={setIconUrl} folder="general" label="Category Icon" hint="Shown as round icon on homepage. Square image works best." previewHeight={80} compact allowUrl />

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

              <View style={styles.langTabs}>
                {LANG_TABS.map((l) => {
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
                      <Text style={[styles.langTabText, isActive && styles.langTabTextActive]}>{l.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {LANG_TABS.map((l) => langTab !== l.code ? null : (
                <View key={l.code}>
                  <Text style={styles.fieldLabel}>{l.code === 'en' ? t.nameRequired : t.nameLabel}</Text>
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

      {/* Subcategory management */}
      {subCatCategory && (
        <SubcategoryModal
          category={subCatCategory}
          onClose={() => setSubCatCategory(null)}
          adminEmail={admin?.email ?? ''}
          adminId={admin?.id ?? ''}
          adminName={admin?.name ?? ''}
          adminRole={admin?.role ?? ''}
        />
      )}

      {/* Delete confirm */}
      <Modal visible={!!deleteId} transparent animationType="fade" onRequestClose={() => setDeleteId(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { maxWidth: 360 }]}>
            <Text style={[styles.modalTitle, { padding: Spacing.lg }]}>{t.deleteCategory}</Text>
            <Text style={[styles.hintText, { paddingHorizontal: Spacing.lg, color: Colors.warning }]}>{t.deleteCategoryWarning}</Text>
            <View style={[styles.modalFooter, { borderTopWidth: 1, borderTopColor: Colors.border }]}>
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

      {/* Hard delete confirm */}
      <Modal visible={!!hardDeleteId} transparent animationType="fade" onRequestClose={() => setHardDeleteId(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { maxWidth: 360 }]}>
            <Text style={[styles.modalTitle, { padding: Spacing.lg }]}>Permanently Delete?</Text>
            <Text style={[styles.hintText, { paddingHorizontal: Spacing.lg, color: Colors.error }]}>
              This cannot be undone. The category and all its translations will be permanently removed.
            </Text>
            <View style={[styles.modalFooter, { borderTopWidth: 1, borderTopColor: Colors.border }]}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setHardDeleteId(null)}>
                <Text style={styles.cancelBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.error }]} onPress={() => hardDeleteId && handleHardDelete(hardDeleteId)}>
                <Text style={styles.saveBtnText}>Delete Permanently</Text>
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
    <AdminGuard permission="manage_categories">
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
  slugCell: { flexDirection: 'column', gap: 2 },
  slugText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', fontFamily: 'monospace' },
  deletedByText: { color: Colors.textMuted, fontSize: FontSize.xs },
  trashToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border },
  trashToggleBtnActive: { borderColor: Colors.error + '66', backgroundColor: Colors.errorDim },
  trashToggleText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  nameText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '500' },
  rtlText: { textAlign: 'right' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1, alignSelf: 'flex-start' },
  statusText: { fontSize: FontSize.xs, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center' },
  editBtn: { width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: Colors.neonBlueGlow, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 30, height: 30, borderRadius: Radius.sm, backgroundColor: Colors.errorDim, justifyContent: 'center', alignItems: 'center' },
  subCatBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, height: 30, borderRadius: Radius.sm, backgroundColor: Colors.gold + '22', borderWidth: 1, borderColor: Colors.gold + '44' },
  subCatBtnText: { color: Colors.gold, fontSize: 10, fontWeight: '700' },
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

// ─── Subcategory modal styles ─────────────────────────────────────────────────

const subStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: Spacing.md },
  panel: { backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.xl, width: '100%', maxWidth: 600, maxHeight: '92%', borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  panelHeader: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  panelTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800' },
  panelSub: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '600', marginTop: 2 },

  inlineToast: { marginHorizontal: Spacing.md, marginTop: Spacing.sm, padding: 10, borderRadius: Radius.md, backgroundColor: Colors.success + '22', borderWidth: 1, borderColor: Colors.success + '55' },
  inlineToastError: { backgroundColor: Colors.error + '22', borderColor: Colors.error + '55' },
  inlineToastText: { color: Colors.success, fontSize: FontSize.sm, fontWeight: '600', textAlign: 'center' },

  listArea: { flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  empty: { alignItems: 'center', paddingVertical: 40, gap: Spacing.sm },
  emptyTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700' },
  emptySub: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },

  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: Spacing.sm, backgroundColor: Colors.backgroundCard, borderRadius: Radius.md, marginBottom: 4, borderWidth: 1, borderColor: Colors.border },
  subInfo: { flex: 1 },
  subName: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700' },
  subMeta: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 1 },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1 },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  subEditBtn: { width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: Colors.neonBlueGlow, justifyContent: 'center', alignItems: 'center' },
  subDeleteBtn: { width: 28, height: 28, borderRadius: Radius.sm, backgroundColor: Colors.errorDim, justifyContent: 'center', alignItems: 'center' },

  panelFooter: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.neonBlue, borderRadius: Radius.md, height: 42 },
  addBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '700' },

  formArea: { borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.md },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  formTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  formFooter: { flexDirection: 'row', gap: Spacing.sm, paddingTop: Spacing.sm },

  fieldLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, marginTop: Spacing.sm },
  input: { backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 9, color: Colors.textPrimary, fontSize: FontSize.sm, marginBottom: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: Spacing.sm },
  switchLabel: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '600' },

  langTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  langTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm },
  langTabActive: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlueBorder },
  langTabText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  langTabTextActive: { color: Colors.neonBlue },

  cancelBtn: { flex: 1, height: 40, borderRadius: Radius.md, backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  saveBtn: { flex: 1, height: 40, borderRadius: Radius.md, backgroundColor: Colors.neonBlue, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },
  translateBtn: { flex: 1, height: 40, borderRadius: Radius.md, backgroundColor: Colors.neonBlueGlow, borderWidth: 1, borderColor: Colors.neonBlueBorder, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 5 },
  translateBtnText: { color: Colors.neonBlue, fontSize: 11, fontWeight: '700' },
});
