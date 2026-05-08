import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import { useRouter } from 'expo-router';
import { Save, Store, Mail, DollarSign, Globe, Share2, Package, Camera, RefreshCw, Upload, Trash2 } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import { supabase, adminSupabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';

const TRYON_BUCKET = 'tryon-models';
const TRYON_SETTING_KEY = 'tryon_model_image_url';

// Resize + center-crop to 4:5 portrait, max 900px wide, output as webp blob
async function prepareModelImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const TARGET_W = 900;
      const TARGET_H = Math.round(TARGET_W * (5 / 4)); // 1125px

      // Determine crop rect (center-crop to 4:5 from source)
      const srcRatio = img.width / img.height;
      const tgtRatio = 4 / 5;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (srcRatio > tgtRatio) {
        // source is wider — crop sides
        sw = Math.round(img.height * tgtRatio);
        sx = Math.round((img.width - sw) / 2);
      } else {
        // source is taller — crop top/bottom
        sh = Math.round(img.width / tgtRatio);
        sy = Math.round((img.height - sh) / 2);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = TARGET_W;
      canvas.height = TARGET_H;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/webp',
        0.88,
      );
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

// ─── Try-On Model Image uploader (web-only component) ─────────────────────────
function TryOnModelSection({
  currentUrl,
  onSaved,
}: {
  currentUrl: string;
  onSaved: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus]     = useState<'idle' | 'ok' | 'err'>('idle');
  const [errMsg, setErrMsg]     = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const displaySrc = preview ?? currentUrl ?? null;

  const pickFile = () => {
    if (!fileRef.current) {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/jpeg,image/png,image/webp';
      inp.style.display = 'none';
      document.body.appendChild(inp);
      fileRef.current = inp;
    }
    const inp = fileRef.current!;
    inp.onchange = async (e: any) => {
      const file: File | undefined = e.target?.files?.[0];
      inp.value = '';
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setErrMsg('Only JPG, PNG or WEBP accepted.'); setStatus('err'); return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setErrMsg('File exceeds 10 MB.'); setStatus('err'); return;
      }
      setStatus('idle'); setErrMsg('');
      try {
        const blob = await prepareModelImage(file);
        setPreview(URL.createObjectURL(blob));
      } catch {
        setErrMsg('Could not process image.'); setStatus('err');
      }
    };
    inp.click();
  };

  const handleSave = async () => {
    if (!preview) return;
    setUploading(true); setStatus('idle'); setErrMsg('');
    try {
      // Fetch blob from local object URL
      const res = await fetch(preview);
      const blob = await res.blob();
      const filename = `model-${Date.now()}.webp`;

      const adminClient = adminSupabase();

      const { data: uploadData, error: uploadError } = await adminClient.storage
        .from(TRYON_BUCKET)
        .upload(filename, blob, { contentType: 'image/webp', upsert: true });

      if (uploadError) {
        console.error('[TryOn] Storage upload error:', uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = adminClient.storage.from(TRYON_BUCKET).getPublicUrl(uploadData.path);
      const publicUrl = urlData.publicUrl;
      if (!publicUrl) {
        console.error('[TryOn] Public URL missing, uploadData:', uploadData);
        throw new Error('Public URL missing after upload');
      }

      const { error: upsertErr } = await adminClient
        .from('site_settings')
        .upsert({ key: TRYON_SETTING_KEY, value: publicUrl }, { onConflict: 'key' });
      if (upsertErr) {
        console.error('[TryOn] site_settings upsert error:', upsertErr);
        throw new Error(`Save failed: ${upsertErr.message}`);
      }

      onSaved(publicUrl);
      setPreview(null);
      setStatus('ok');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      console.error('[TryOn] handleSave error:', err);
      setErrMsg(err?.message ?? 'Upload failed. Check console for details.');
      setStatus('err');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = async () => {
    setConfirmReset(false);
    setUploading(true); setStatus('idle'); setErrMsg('');
    try {
      const { error: resetErr } = await adminSupabase()
        .from('site_settings')
        .upsert({ key: TRYON_SETTING_KEY, value: '' }, { onConflict: 'key' });
      if (resetErr) {
        console.error('[TryOn] Reset upsert error:', resetErr);
        throw new Error(resetErr.message);
      }
      onSaved('');
      setPreview(null);
      setStatus('ok');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err: any) {
      console.error('[TryOn] handleReset error:', err);
      setErrMsg(err?.message ?? 'Reset failed.');
      setStatus('err');
    } finally {
      setUploading(false);
    }
  };

  const discardPreview = () => { setPreview(null); setStatus('idle'); setErrMsg(''); };

  if (Platform.OS !== 'web') {
    return (
      <View style={tryon.unavailableBox}>
        <Text style={tryon.unavailableText}>Try-On model image upload is only available on web.</Text>
      </View>
    );
  }

  return (
    <View style={tryon.root}>
      {/* Preview */}
      <View style={tryon.previewWrap}>
        {displaySrc ? (
          <Image
            source={{ uri: displaySrc }}
            style={tryon.previewImg}
            resizeMode="cover"
          />
        ) : (
          <View style={[tryon.previewImg, tryon.previewPlaceholder]}>
            <Camera size={32} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={tryon.placeholderText}>No model image saved</Text>
          </View>
        )}
        {preview && (
          <View style={tryon.pendingBadge}>
            <Text style={tryon.pendingText}>Unsaved preview</Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={tryon.controls}>
        <Text style={tryon.hint}>
          Upload a portrait photo (JPG / PNG / WEBP). It will be automatically cropped to 4:5 ratio at 900 px wide.
        </Text>

        <View style={tryon.btnRow}>
          <TouchableOpacity style={tryon.pickBtn} onPress={pickFile} activeOpacity={0.8} disabled={uploading}>
            <Upload size={14} color={Colors.neonBlue} strokeWidth={2} />
            <Text style={tryon.pickBtnText}>Choose image</Text>
          </TouchableOpacity>

          {preview && (
            <>
              <TouchableOpacity
                style={[tryon.saveBtn, uploading && { opacity: 0.6 }]}
                onPress={handleSave}
                activeOpacity={0.85}
                disabled={uploading}
              >
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Save size={14} color="#fff" strokeWidth={2.5} />}
                <Text style={tryon.saveBtnText}>{uploading ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={tryon.discardBtn} onPress={discardPreview} activeOpacity={0.8} disabled={uploading}>
                <Trash2 size={14} color={Colors.error} strokeWidth={2} />
              </TouchableOpacity>
            </>
          )}

          {!preview && (
            <TouchableOpacity
              style={[tryon.resetBtn, uploading && { opacity: 0.6 }]}
              onPress={() => setConfirmReset(true)}
              activeOpacity={0.8}
              disabled={uploading}
            >
              <RefreshCw size={13} color={Colors.textMuted} strokeWidth={2} />
              <Text style={tryon.resetBtnText}>Reset to default</Text>
            </TouchableOpacity>
          )}
        </View>

        {status === 'ok' && <Text style={tryon.okText}>Saved successfully!</Text>}
        {status === 'err' && <Text style={tryon.errText}>{errMsg}</Text>}
      </View>

      {/* Reset confirmation modal */}
      <Modal visible={confirmReset} transparent animationType="fade" onRequestClose={() => setConfirmReset(false)}>
        <Pressable style={tryon.modalOverlay} onPress={() => setConfirmReset(false)}>
          <Pressable style={tryon.modalBox} onPress={() => {}}>
            <Text style={tryon.modalTitle}>Remove model image?</Text>
            <Text style={tryon.modalBody}>
              This will clear the saved model image from Virtual Try-On. Customers will see no default model until a new image is uploaded.
            </Text>
            <View style={tryon.modalBtns}>
              <TouchableOpacity style={tryon.modalCancel} onPress={() => setConfirmReset(false)} activeOpacity={0.8}>
                <Text style={tryon.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={tryon.modalConfirm} onPress={handleReset} activeOpacity={0.8}>
                <Text style={tryon.modalConfirmText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

type SettingsMap = Record<string, string>;

const SETTING_GROUPS = [
  {
    title: 'Store Identity',
    icon: Store,
    fields: [
      { key: 'store_name', label: 'Store Name', placeholder: 'Lazurde Makeup' },
      { key: 'store_tagline', label: 'Store Tagline', placeholder: 'Premium Makeup Products' },
      { key: 'logo_url', label: 'Logo URL', placeholder: 'https://...', hint: 'Direct link to your logo image' },
    ],
  },
  {
    title: 'Contact Information',
    icon: Mail,
    fields: [
      { key: 'contact_email', label: 'Contact Email', placeholder: 'hello@yourstore.com', keyboardType: 'email-address' },
      { key: 'contact_phone', label: 'Contact Phone', placeholder: '+1 (800) 000-0000', keyboardType: 'phone-pad' },
      { key: 'contact_address_line1', label: 'Address Line 1', placeholder: '123 Main Street' },
      { key: 'contact_address_line2', label: 'Address Line 2', placeholder: 'Suite 100 (optional)' },
      { key: 'contact_city', label: 'City', placeholder: 'Beverly Hills' },
      { key: 'contact_state', label: 'State / Province', placeholder: 'CA' },
      { key: 'contact_zip', label: 'ZIP / Postal Code', placeholder: '90210' },
      { key: 'contact_country', label: 'Country', placeholder: 'United States' },
    ],
  },
  {
    title: 'Social Links',
    icon: Share2,
    fields: [
      { key: 'social_instagram', label: 'Instagram URL', placeholder: 'https://instagram.com/...' },
      { key: 'social_facebook', label: 'Facebook URL', placeholder: 'https://facebook.com/...' },
      { key: 'social_twitter', label: 'X / Twitter URL', placeholder: 'https://x.com/...' },
      { key: 'social_youtube', label: 'YouTube URL', placeholder: 'https://youtube.com/...' },
    ],
  },
  {
    title: 'Commerce Settings',
    icon: DollarSign,
    fields: [
      { key: 'currency', label: 'Currency', placeholder: 'USD' },
      { key: 'shipping_free_threshold', label: 'Free Shipping Threshold ($)', placeholder: '150', keyboardType: 'decimal-pad', hint: 'Orders above this amount get free shipping' },
      { key: 'tax_rate', label: 'Tax Rate (%)', placeholder: '8.5', keyboardType: 'decimal-pad', hint: 'Percentage applied at checkout' },
    ],
  },
  {
    title: 'Localization',
    icon: Globe,
    fields: [
      { key: 'language', label: 'Language', placeholder: 'en', hint: 'Language code (e.g., en, es, fr)' },
      { key: 'timezone', label: 'Timezone', placeholder: 'America/New_York', hint: 'IANA timezone (e.g., America/Los_Angeles)' },
      { key: 'date_format', label: 'Date Format', placeholder: 'MM/DD/YYYY' },
    ],
  },
];

function SettingsScreen() {
  const { isAdminAuthenticated } = useAdmin();
  const router = useRouter();
  const { isMobile } = useAdminLayout();
  const { t } = useLanguage();

  const groupTitleMap: Record<string, string> = {
    'Store Identity': t.storeIdentityGroup,
    'Contact Information': t.contactInformationGroup,
    'Social Links': t.socialLinksGroup,
    'Commerce Settings': t.commerceSettingsGroup,
    'Localization': t.localizationGroup,
  };

  const fieldLabelMap: Record<string, string> = {
    'Store Name': t.storeName,
    'Store Tagline': t.storeTagline,
    'Logo URL': t.logoUrl,
    'Contact Email': t.supportEmail,
    'Contact Phone': t.supportPhone,
    'Address Line 1': t.address,
    'Address Line 2': t.optional,
    'City': t.city,
    'State / Province': t.state,
    'ZIP / Postal Code': t.zip,
    'Country': t.country,
    'Instagram URL': t.instagramUrl,
    'Facebook URL': t.facebookUrl,
    'X / Twitter URL': t.twitterUrl,
    'YouTube URL': t.youtubeUrl,
    'Currency': t.currencyCode,
    'Free Shipping Threshold ($)': t.freeShippingThreshold,
    'Tax Rate (%)': t.taxRate,
    'Language': t.defaultLanguage,
    'Timezone': t.timezone,
    'Date Format': t.optional,
  };
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tryonModelUrl, setTryonModelUrl] = useState('');

  useEffect(() => {
    if (!isAdminAuthenticated) { router.replace('/admin/login'); return; }
    fetchSettings();
  }, [isAdminAuthenticated]);

  const fetchSettings = async () => {
    const { data } = await supabase.from('site_settings').select('*');
    const map: SettingsMap = {};
    (data ?? []).forEach((row: any) => { map[row.key] = row.value; });
    setSettings(map);
    setTryonModelUrl(map[TRYON_SETTING_KEY] ?? '');
    setLoading(false);
  };

  const updateField = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const db = adminSupabase();
    for (const [key, value] of Object.entries(settings)) {
      await db
        .from('site_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const Shell = isMobile ? AdminMobileDashboard : AdminWebDashboard;

  if (loading) {
    return (
      <Shell title={t.settings} showBack={isMobile}>
        <ActivityIndicator color={Colors.neonBlue} style={{ marginTop: 60 }} />
      </Shell>
    );
  }

  return (
    <Shell title={t.settings} showBack={isMobile}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.description}>{t.configureStoreDesc}</Text>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={Colors.background} size="small" />
            ) : saved ? (
              <Text style={styles.saveBtnText}>{t.savedBang}</Text>
            ) : (
              <>
                <Save size={15} color={Colors.background} strokeWidth={2.5} />
                <Text style={styles.saveBtnText}>{t.save}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {SETTING_GROUPS.map((group) => {
          const Icon = group.icon;
          return (
            <View key={group.title} style={styles.card}>
              <View style={styles.cardHeader}>
                <Icon size={18} color={Colors.neonBlue} strokeWidth={2} />
                <Text style={styles.cardTitle}>{groupTitleMap[group.title] ?? group.title}</Text>
              </View>
              {group.fields.map((field) => (
                <View key={field.key} style={styles.fieldWrap}>
                  <Text style={styles.fieldLabel}>{fieldLabelMap[field.label] ?? field.label}</Text>
                  {(field as any).hint && <Text style={styles.fieldHint}>{(field as any).hint}</Text>}
                  <TextInput
                    style={styles.input}
                    value={settings[field.key] ?? ''}
                    onChangeText={(v) => updateField(field.key, v)}
                    placeholder={field.placeholder}
                    placeholderTextColor={Colors.textMuted}
                    keyboardType={(field as any).keyboardType ?? 'default'}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
            </View>
          );
        })}

        {/* ── Try-On Model Image ── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Camera size={18} color={Colors.neonBlue} strokeWidth={2} />
            <Text style={styles.cardTitle}>Try-On Model Image</Text>
          </View>
          <Text style={[styles.fieldHint, { marginBottom: Spacing.md }]}>
            This image is shown by default when customers open Virtual Try-On. Upload a clear, front-facing portrait photo.
          </Text>
          <TryOnModelSection
            currentUrl={tryonModelUrl}
            onSaved={(url) => {
              setTryonModelUrl(url);
              setSettings(prev => ({ ...prev, [TRYON_SETTING_KEY]: url }));
            }}
          />
        </View>

        <View style={styles.dangerCard}>
          <View style={styles.cardHeader}>
            <Package size={18} color={Colors.error} strokeWidth={2} />
            <Text style={[styles.cardTitle, { color: Colors.error }]}>{t.adminInfoGroup}</Text>
          </View>
          <Text style={styles.dangerText}>{t.adminInfoDesc}</Text>
          <View style={styles.credentialsBox}>
            <Text style={styles.credLabel}>{t.defaultLoginCredentials}</Text>
            <Text style={styles.credValue}>Email: admin@glowbeauty.com</Text>
            <Text style={styles.credValue}>Password: admin123</Text>
          </View>
        </View>
      </View>
    </Shell>
  );
}

export default function SettingsScreenGuarded() {
  return (
    <AdminGuard permission="manage_settings">
      <SettingsScreen />
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg, gap: Spacing.md },
  description: { flex: 1, color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.neonBlue, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, flexShrink: 0 },
  saveBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },
  card: { backgroundColor: Colors.backgroundCard, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg },
  cardTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700' },
  fieldWrap: { marginBottom: Spacing.md },
  fieldLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  fieldHint: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: 4 },
  input: { backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, color: Colors.textPrimary, fontSize: FontSize.md },
  dangerCard: { backgroundColor: Colors.errorDim, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.error + '33' },
  dangerText: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.md },
  credentialsBox: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  credLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  credValue: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '500', fontFamily: 'monospace' as any },
});

const tryon = StyleSheet.create({
  root: { flexDirection: 'row', gap: Spacing.lg, flexWrap: 'wrap' },
  previewWrap: {
    width: 144, height: 180, borderRadius: Radius.md, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border, position: 'relative', flexShrink: 0,
  },
  previewImg: { width: 144, height: 180 },
  pendingBadge: {
    position: 'absolute', bottom: 6, left: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: Radius.sm,
    paddingVertical: 3, alignItems: 'center',
  },
  pendingText: { color: Colors.warning, fontSize: 9, fontWeight: '700' },
  controls: { flex: 1, gap: 10, minWidth: 200 },
  hint: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.neonBlueGlow, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.neonBlueBorder,
  },
  pickBtnText: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '700' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.neonBlue, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  saveBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },
  discardBtn: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.errorDim, borderWidth: 1, borderColor: Colors.error + '44',
    justifyContent: 'center', alignItems: 'center',
  },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.border,
  },
  resetBtnText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  okText: { color: Colors.success, fontSize: FontSize.xs, fontWeight: '700' },
  errText: { color: Colors.error, fontSize: FontSize.xs, fontWeight: '600' },
  unavailableBox: {
    padding: Spacing.md, backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
  },
  unavailableText: { color: Colors.textMuted, fontSize: FontSize.sm },
  previewPlaceholder: {
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  placeholderText: { color: Colors.textMuted, fontSize: 10, textAlign: 'center', paddingHorizontal: 8 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.xl,
  },
  modalBox: {
    backgroundColor: Colors.backgroundCard, borderRadius: Radius.lg,
    padding: Spacing.xl, width: '100%', maxWidth: 400,
    borderWidth: 1, borderColor: Colors.border,
    gap: Spacing.md,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '700' },
  modalBody: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 20 },
  modalBtns: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end', marginTop: Spacing.xs },
  modalCancel: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  modalCancelText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  modalConfirm: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, backgroundColor: Colors.error,
  },
  modalConfirmText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '700' },
});
