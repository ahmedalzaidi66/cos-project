import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { Save, CircleCheck as CheckCircle, Globe, Instagram, Music2, Facebook, MessageCircle, Mail, Phone, Package, RotateCcw } from 'lucide-react-native';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import { supabase, adminSupabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'ar', label: 'AR', full: 'العربية' },
  { code: 'es', label: 'ES', full: 'Español' },
  { code: 'de', label: 'DE', full: 'Deutsch' },
  { code: 'ru', label: 'RU', full: 'Русский' },
];

type Tab = 'brand' | 'social' | 'contact' | 'shipping' | 'return';
const TABS: { id: Tab; label: string }[] = [
  { id: 'brand',    label: 'Brand'    },
  { id: 'social',   label: 'Social'   },
  { id: 'contact',  label: 'Contact'  },
  { id: 'shipping', label: 'Shipping' },
  { id: 'return',   label: 'Returns'  },
];

// Fields that are language-neutral (shared across all languages — stored under 'en' only)
const LANG_NEUTRAL_FIELDS = new Set([
  'instagram_url', 'instagram_handle',
  'tiktok_url', 'tiktok_handle',
  'facebook_url', 'facebook_handle',
  'whatsapp', 'email', 'phone',
]);

// ─── Field types ──────────────────────────────────────────────────────────────

type FieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  langNeutral?: boolean;
};

const BRAND_FIELDS: FieldDef[] = [
  { key: 'name',        label: 'Brand Name',        placeholder: 'LAZURDE MAKEUP' },
  { key: 'tagline',     label: 'Tagline',            placeholder: 'Professional gear trusted worldwide' },
  { key: 'description', label: 'Brand Description',  placeholder: 'Describe your brand...', multiline: true },
  { key: 'mission',     label: 'Mission Statement',  placeholder: 'Our mission is...', multiline: true },
];

const SOCIAL_FIELDS: FieldDef[] = [
  { key: 'instagram_url',    label: 'Instagram URL',       placeholder: 'https://www.instagram.com/brand', langNeutral: true },
  { key: 'instagram_handle', label: 'Instagram Handle',    placeholder: '@brand', langNeutral: true },
  { key: 'tiktok_url',       label: 'TikTok URL',          placeholder: 'https://www.tiktok.com/@brand', langNeutral: true },
  { key: 'tiktok_handle',    label: 'TikTok Handle',       placeholder: '@brand', langNeutral: true },
  { key: 'facebook_url',     label: 'Facebook URL',        placeholder: 'https://www.facebook.com/brand', langNeutral: true },
  { key: 'facebook_handle',  label: 'Facebook Page Name',  placeholder: 'Brand Page', langNeutral: true },
];

const CONTACT_FIELDS: FieldDef[] = [
  { key: 'whatsapp', label: 'WhatsApp Number (digits only)', placeholder: '15550001234', langNeutral: true },
  { key: 'email',    label: 'Support Email',                 placeholder: 'support@brand.com', langNeutral: true },
  { key: 'phone',    label: 'Phone',                        placeholder: '+1 (800) 555-0199', langNeutral: true },
];

const SHIPPING_FIELDS: FieldDef[] = [
  { key: 'title',    label: 'Section Title',  placeholder: 'Shipping Policy' },
  { key: 'delivery', label: 'Delivery Time',  placeholder: '3–7 business days', multiline: true },
  { key: 'areas',    label: 'Shipping Areas', placeholder: 'We ship worldwide to 80+ countries.', multiline: true },
  { key: 'cost',     label: 'Shipping Cost',  placeholder: 'Free on orders over $500.', multiline: true },
];

const RETURN_FIELDS: FieldDef[] = [
  { key: 'title',      label: 'Section Title',     placeholder: 'Return Policy' },
  { key: 'days',       label: 'Return Window',      placeholder: '30-day returns', multiline: true },
  { key: 'conditions', label: 'Conditions',         placeholder: 'Unused, with original packaging', multiline: true },
  { key: 'refund',     label: 'Refund Process',     placeholder: 'Full refund within 5–10 days', multiline: true },
];

const FIELDS_BY_TAB: Record<Tab, FieldDef[]> = {
  brand:    BRAND_FIELDS,
  social:   SOCIAL_FIELDS,
  contact:  CONTACT_FIELDS,
  shipping: SHIPPING_FIELDS,
  return:   RETURN_FIELDS,
};

// ─── Data helpers ─────────────────────────────────────────────────────────────

type ContentMap = Record<string, string>;

async function loadSectionContent(section: string, language: string): Promise<ContentMap> {
  // For lang-neutral fields always fetch from 'en'; for translatable fetch requested lang
  const { data } = await supabase
    .from('about_content')
    .select('key, value')
    .eq('section', section)
    .in('language', language === 'en' ? ['en'] : ['en', language]);

  const map: ContentMap = {};
  const enMap: ContentMap = {};
  const langMap: ContentMap = {};

  for (const row of (data ?? []) as { key: string; value: string; language?: string }[]) {
    const r = row as any;
    if (r.language === 'en') enMap[r.key] = r.value;
    else langMap[r.key] = r.value;
  }

  // Merge: lang-specific wins for translatable keys; en always wins for lang-neutral
  const fields = FIELDS_BY_TAB[section as Tab] ?? [];
  for (const f of fields) {
    if (f.langNeutral) {
      map[f.key] = enMap[f.key] ?? '';
    } else {
      map[f.key] = langMap[f.key] ?? enMap[f.key] ?? '';
    }
  }
  return map;
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AdminAboutScreen() {
  const { isMobile } = useAdminLayout();
  const { t } = useLanguage();

  const content = (
    <AdminGuard>
      <AboutEditor />
    </AdminGuard>
  );

  if (isMobile) {
    return <AdminMobileDashboard title="About & Contact">{content}</AdminMobileDashboard>;
  }
  return <AdminWebDashboard>{content}</AdminWebDashboard>;
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function AboutEditor() {
  const [tab, setTab] = useState<Tab>('brand');
  const [language, setLanguage] = useState('en');
  const [fields, setFields] = useState<ContentMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTab = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await loadSectionContent(tab, language);
    setFields(data);
    setLoading(false);
  }, [tab, language]);

  useEffect(() => { loadTab(); }, [loadTab]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    const db = adminSupabase();
    const fieldDefs = FIELDS_BY_TAB[tab];

    try {
      const rows = fieldDefs.map((f) => ({
        section: tab,
        key: f.key,
        value: fields[f.key] ?? '',
        language: f.langNeutral ? 'en' : language,
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertErr } = await db
        .from('about_content')
        .upsert(rows, { onConflict: 'section,key,language' });

      if (upsertErr) throw upsertErr;

      // For non-English translatable fields: also seed English fallback if missing
      if (language !== 'en') {
        const translatableRows = fieldDefs
          .filter((f) => !f.langNeutral)
          .map((f) => ({
            section: tab,
            key: f.key,
            value: fields[f.key] ?? '',
            language: 'en',
            updated_at: new Date().toISOString(),
          }));

        // Only insert English rows where they don't exist yet (DO NOTHING)
        if (translatableRows.length > 0) {
          await supabase
            .from('about_content')
            .upsert(translatableRows, { onConflict: 'section,key,language', ignoreDuplicates: true });
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [tab, language, fields]);

  const fieldDefs = FIELDS_BY_TAB[tab];

  return (
    <View style={s.container}>
      {/* ── Page title ─────────────────────────────────────────────────── */}
      <View style={s.pageHeader}>
        <Text style={s.pageTitle}>About & Contact</Text>
        <Text style={s.pageSubtitle}>Edit your About page content, social links, and policies</Text>
      </View>

      <View style={s.body}>
        {/* ── Left column: controls ───────────────────────────────────── */}
        <View style={s.leftCol}>
          {/* Language picker */}
          <View style={s.controlBlock}>
            <Text style={s.controlLabel}>LANGUAGE</Text>
            <View style={s.langRow}>
              {LANGUAGES.map((l) => (
                <TouchableOpacity
                  key={l.code}
                  style={[s.langBtn, language === l.code && s.langBtnActive]}
                  onPress={() => setLanguage(l.code)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.langBtnText, language === l.code && s.langBtnTextActive]}>
                    {l.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tab picker */}
          <View style={s.controlBlock}>
            <Text style={s.controlLabel}>SECTION</Text>
            <View style={s.tabList}>
              {TABS.map((tb) => (
                <TouchableOpacity
                  key={tb.id}
                  style={[s.tabBtn, tab === tb.id && s.tabBtnActive]}
                  onPress={() => setTab(tb.id)}
                  activeOpacity={0.75}
                >
                  <TabIcon id={tb.id} active={tab === tb.id} />
                  <Text style={[s.tabBtnText, tab === tb.id && s.tabBtnTextActive]}>
                    {tb.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ── Right column: fields ──────────────────────────────────────── */}
        <View style={s.rightCol}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.editorCard}>
              <View style={s.editorCardHeader}>
                <TabIcon id={tab} active />
                <Text style={s.editorCardTitle}>{TABS.find((tb) => tb.id === tab)?.label}</Text>
                {tab !== 'social' && tab !== 'contact' && (
                  <View style={s.langBadge}>
                    <Globe size={10} color={Colors.neonBlue} strokeWidth={2} />
                    <Text style={s.langBadgeText}>{LANGUAGES.find(l => l.code === language)?.full}</Text>
                  </View>
                )}
                {(tab === 'social' || tab === 'contact') && (
                  <View style={s.langBadge}>
                    <Globe size={10} color={Colors.textMuted} strokeWidth={2} />
                    <Text style={[s.langBadgeText, { color: Colors.textMuted }]}>All languages</Text>
                  </View>
                )}
              </View>

              {loading ? (
                <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 32 }} />
              ) : (
                <View style={s.fieldList}>
                  {fieldDefs.map((f) => (
                    <FieldInput
                      key={f.key}
                      label={f.label}
                      placeholder={f.placeholder}
                      value={fields[f.key] ?? ''}
                      multiline={f.multiline}
                      langNeutral={f.langNeutral}
                      onChange={(v) => setFields((prev) => ({ ...prev, [f.key]: v }))}
                    />
                  ))}
                </View>
              )}

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[s.saveBtn, saving && s.saveBtnDisabled]}
                onPress={handleSave}
                activeOpacity={0.85}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#0A0507" size="small" />
                ) : saved ? (
                  <>
                    <CheckCircle size={16} color="#0A0507" strokeWidth={2.5} />
                    <Text style={s.saveBtnText}>Saved!</Text>
                  </>
                ) : (
                  <>
                    <Save size={16} color="#0A0507" strokeWidth={2.5} />
                    <Text style={s.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

// ─── Tab icon helper ──────────────────────────────────────────────────────────

function TabIcon({ id, active }: { id: Tab; active: boolean }) {
  const color = active ? Colors.neonBlue : Colors.textMuted;
  const props = { size: 14, color, strokeWidth: 2 };
  if (id === 'brand') return <Globe {...props} />;
  if (id === 'social') return <Instagram {...props} />;
  if (id === 'contact') return <MessageCircle {...props} />;
  if (id === 'shipping') return <Package {...props} />;
  if (id === 'return') return <RotateCcw {...props} />;
  return null;
}

// ─── Field input component ────────────────────────────────────────────────────

function FieldInput({
  label, placeholder, value, multiline, langNeutral, onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  multiline?: boolean;
  langNeutral?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.field}>
      <View style={s.fieldLabelRow}>
        <Text style={s.fieldLabel}>{label}</Text>
        {langNeutral && (
          <View style={s.neutralBadge}>
            <Text style={s.neutralBadgeText}>Global</Text>
          </View>
        )}
      </View>
      <TextInput
        style={[s.fieldInput, multiline && s.fieldInputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pageHeader: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pageTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  body: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
  },

  // ── Left column ───────────────────────────────────────────────────────────
  leftCol: {
    width: Platform.OS === 'web' ? 220 : '100%',
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightColor: Colors.border,
    borderBottomWidth: Platform.OS === 'web' ? 0 : 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.lg,
  },
  controlBlock: {
    gap: Spacing.sm,
  },
  controlLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  langBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
  },
  langBtnActive: {
    borderColor: Colors.neonBlue,
    backgroundColor: 'rgba(255,77,141,0.1)',
  },
  langBtnText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  langBtnTextActive: {
    color: Colors.neonBlue,
  },
  tabList: {
    gap: 4,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnActive: {
    borderColor: Colors.neonBlueBorder,
    backgroundColor: Colors.neonBlueGlow,
  },
  tabBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },

  // ── Right column ──────────────────────────────────────────────────────────
  rightCol: {
    flex: 1,
    padding: Spacing.lg,
  },
  editorCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  editorCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  editorCardTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.lg,
    fontWeight: '800',
    flex: 1,
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    backgroundColor: Colors.neonBlueGlow,
  },
  langBadgeText: {
    color: Colors.neonBlue,
    fontSize: 10,
    fontWeight: '700',
  },

  // ── Fields ────────────────────────────────────────────────────────────────
  fieldList: {
    gap: Spacing.md,
  },
  field: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  neutralBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,191,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.3)',
  },
  neutralBadgeText: {
    color: '#FFB300',
    fontSize: 9,
    fontWeight: '700',
  },
  fieldInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
  },
  fieldInputMulti: {
    minHeight: 90,
    paddingTop: 10,
  },

  // ── Save button ────────────────────────────────────────────────────────────
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.full,
    paddingVertical: 14,
    marginTop: 8,
    shadowColor: Colors.neonBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    color: '#0A0507',
    fontSize: FontSize.md,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  errorText: {
    color: '#FF4444',
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
