import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Switch,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import {
  X,
  Image as ImageIcon,
  Type,
  MousePointerClick,
  Hash,
  Palette,
  Link,
  Upload,
} from 'lucide-react-native';
import { PageBlock, BlockType, usePageBuilder } from '@/context/PageBuilderContext';
import ImageUploader from '@/components/admin/ImageUploader';
import { useLanguage } from '@/context/LanguageContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

type Props = {
  block: PageBlock;
  onClose: () => void;
};

const BLOCK_LABELS: Record<BlockType, string> = {
  header: 'Header',
  hero: 'Hero Banner',
  featured: 'Featured Products',
  canopy: 'Beauty Filter',
  testimonials: 'Testimonials',
  banner: 'Promotions Banner',
  footer: 'Footer',
  section_row: 'Product Section',
};

export default function BlockSettingsPanel({ block, onClose }: Props) {
  const { updateBlockContent } = usePageBuilder();
  const { t } = useLanguage();
  const content = block.content;

  const set = (key: string, value: any) => {
    updateBlockContent(block.id, { [key]: value });
  };

  const blockLabels: Record<BlockType, string> = {
    header: t.blockLabelHeader,
    hero: t.blockLabelHero,
    featured: t.blockLabelFeatured,
    canopy: t.blockLabelCanopy,
    testimonials: t.blockLabelTestimonials,
    banner: t.blockLabelBanner,
    footer: t.blockLabelFooter,
    section_row: content.title_en || content.title_ar || 'Product Section',
  };

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitle}>
          <View style={styles.blockTypeBadge}>
            <Text style={styles.blockTypeText}>{blockLabels[block.type]}</Text>
          </View>
          <Text style={styles.panelTitleText}>{t.blockSettings}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <X size={18} color={Colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.panelBody} showsVerticalScrollIndicator={false}>
        {block.type === 'header' && <HeaderSettings content={content} set={set} />}
        {block.type === 'hero' && <HeroSettings content={content} set={set} />}
        {block.type === 'featured' && <FeaturedSettings content={content} set={set} />}
        {block.type === 'canopy' && <CanopySettings content={content} set={set} />}
        {block.type === 'testimonials' && <TestimonialsSettings content={content} set={set} />}
        {block.type === 'banner' && <BannerSettings content={content} set={set} />}
        {block.type === 'footer' && <FooterSettings content={content} set={set} />}
        {block.type === 'section_row' && <SectionRowInfo content={content} />}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, multiline, hint, icon,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; hint?: string; icon?: React.ReactNode;
}) {
  return (
    <View style={fs.wrapper}>
      <Text style={fs.label}>{label}</Text>
      {hint ? <Text style={fs.hint}>{hint}</Text> : null}
      <View style={fs.inputRow}>
        {icon ? <View style={fs.inputIcon}>{icon}</View> : null}
        <TextInput
          style={[fs.input, icon && fs.inputWithIcon, multiline && fs.multiline]}
          value={value ?? ''}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

function ImageField({ label, value, onChange, hint }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  const [err, setErr] = React.useState(false);
  return (
    <View style={fs.wrapper}>
      <Text style={fs.label}>{label}</Text>
      {hint ? <Text style={fs.hint}>{hint}</Text> : null}
      <View style={fs.imgPreview}>
        {value && !err ? (
          <Image source={{ uri: value }} style={StyleSheet.absoluteFillObject} resizeMode="cover" onError={() => setErr(true)} />
        ) : (
          <View style={fs.imgPlaceholder}>
            <Upload size={16} color={Colors.textMuted} strokeWidth={1.5} />
            <Text style={fs.imgPlaceholderText}>{err ? 'Failed to load' : 'No image'}</Text>
          </View>
        )}
      </View>
      <View style={fs.inputRow}>
        <View style={fs.inputIcon}>
          <ImageIcon size={13} color={Colors.textMuted} strokeWidth={2} />
        </View>
        <TextInput
          style={[fs.input, fs.inputWithIcon]}
          value={value ?? ''}
          onChangeText={(v) => { setErr(false); onChange(v); }}
          placeholder="https://images.pexels.com/..."
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={fs.toggleRow}>
      <Text style={fs.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: Colors.neonBlue, false: Colors.border }} thumbColor={Colors.white} />
    </View>
  );
}

function SegmentField({ label, options, value, onChange }: {
  label: string; options: { id: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={fs.wrapper}>
      <Text style={fs.label}>{label}</Text>
      <View style={fs.segmentRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.id}
            style={[fs.segment, value === opt.id && fs.segmentActive]}
            onPress={() => onChange(opt.id)}
            activeOpacity={0.7}
          >
            <Text style={[fs.segmentText, value === opt.id && fs.segmentTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <View style={fs.dividerRow}>
      <View style={fs.dividerLine} />
      <Text style={fs.dividerText}>{title}</Text>
      <View style={fs.dividerLine} />
    </View>
  );
}

function HeaderSettings({ content, set }: { content: any; set: (k: string, v: any) => void }) {
  const { t } = useLanguage();
  return (
    <View>
      <Toggle label={t.showHeaderIcons} value={content.show_cart !== false} onChange={v => set('show_cart', v)} />
      <Toggle label={t.showHeaderIcons} value={content.show_account !== false} onChange={v => set('show_account', v)} />
    </View>
  );
}

function HeroSettings({ content, set }: { content: any; set: (k: string, v: any) => void }) {
  const { t } = useLanguage();
  return (
    <View>
      <ImageUploader
        label={t.backgroundImage}
        value={content.image_url ?? ''}
        onChange={v => set('image_url', v)}
        folder="cms"
        previewHeight={110}
        hint={t.backgroundImageHint}
        allowUrl
        editorPreset="hero"
      />
      <Field
        label={t.overlayColor}
        value={content.overlay_color ?? 'rgba(5,10,20,0.55)'}
        onChange={v => set('overlay_color', v)}
        placeholder="rgba(5,10,20,0.55)"
        hint={t.overlayColorHint}
        icon={<Palette size={13} color={Colors.textMuted} strokeWidth={2} />}
      />
      <SectionDivider title={t.textContent} />
      <Field label={t.badgeText} value={content.badge_text ?? ''} onChange={v => set('badge_text', v)} placeholder="PREMIUM MAKEUP" icon={<Type size={13} color={Colors.textMuted} strokeWidth={2} />} />
      <Field label={t.heroTitle} value={content.title ?? ''} onChange={v => set('title', v)} placeholder="Beauty That Makes You Shine" multiline icon={<Type size={13} color={Colors.textMuted} strokeWidth={2} />} />
      <Field label={t.heroSubtitle} value={content.subtitle ?? ''} onChange={v => set('subtitle', v)} placeholder="Premium cosmetics loved by beauty enthusiasts worldwide" multiline />
      <SectionDivider title={t.buttons} />
      <Field label={t.primaryButton} value={content.cta_primary ?? ''} onChange={v => set('cta_primary', v)} placeholder="Shop Now" icon={<MousePointerClick size={13} color={Colors.textMuted} strokeWidth={2} />} />
      <Field label={t.secondaryButton} value={content.cta_secondary ?? ''} onChange={v => set('cta_secondary', v)} placeholder="View Featured" />
    </View>
  );
}

function FeaturedSettings({ content, set }: { content: any; set: (k: string, v: any) => void }) {
  const { t } = useLanguage();
  return (
    <View>
      <Field label={t.sectionTitle} value={content.title ?? ''} onChange={v => set('title', v)} placeholder="Featured Products" icon={<Type size={13} color={Colors.textMuted} strokeWidth={2} />} />
      <Field label={t.sectionSubtitle} value={content.subtitle ?? ''} onChange={v => set('subtitle', v)} placeholder="Hand-picked by our experts" />
      <Field
        label={t.maxProducts}
        value={String(content.max_products ?? 6)}
        onChange={v => set('max_products', parseInt(v) || 6)}
        placeholder="6"
        icon={<Hash size={13} color={Colors.textMuted} strokeWidth={2} />}
      />
      <SegmentField
        label={t.layout}
        options={[{ id: 'grid', label: 'Grid' }, { id: 'list', label: 'List' }]}
        value={content.layout ?? 'grid'}
        onChange={v => set('layout', v)}
      />
    </View>
  );
}

function CanopySettings({ content, set }: { content: any; set: (k: string, v: any) => void }) {
  const { t } = useLanguage();
  return (
    <View>
      <Field label={t.sectionTitle} value={content.title ?? ''} onChange={v => set('title', v)} placeholder="Beauty Filter" icon={<Type size={13} color={Colors.textMuted} strokeWidth={2} />} />
      <Field label={t.canopyDescription} value={content.subtitle ?? ''} onChange={v => set('subtitle', v)} placeholder="Try shades on your photo..." multiline />
      <Field label={t.ctaButtonText} value={content.cta_text ?? ''} onChange={v => set('cta_text', v)} placeholder="Try Shade Advisor" icon={<MousePointerClick size={13} color={Colors.textMuted} strokeWidth={2} />} />
    </View>
  );
}

function TestimonialsSettings({ content, set }: { content: any; set: (k: string, v: any) => void }) {
  const { t } = useLanguage();
  return (
    <View>
      <Field label={t.sectionTitle} value={content.title ?? ''} onChange={v => set('title', v)} placeholder="Loved by Beauty Enthusiasts" icon={<Type size={13} color={Colors.textMuted} strokeWidth={2} />} />
      <Field label={t.sectionSubtitle} value={content.subtitle ?? ''} onChange={v => set('subtitle', v)} placeholder="Hear from our community" multiline />
      <Field
        label={t.maxItems}
        value={String(content.max_items ?? 6)}
        onChange={v => set('max_items', parseInt(v) || 6)}
        placeholder="6"
        icon={<Hash size={13} color={Colors.textMuted} strokeWidth={2} />}
      />
    </View>
  );
}

function BannerSettings({ content, set }: { content: any; set: (k: string, v: any) => void }) {
  const { t } = useLanguage();
  return (
    <View>
      <Field label={t.bannerText} value={content.text ?? ''} onChange={v => set('text', v)} placeholder="Free shipping on orders over $500" multiline icon={<Type size={13} color={Colors.textMuted} strokeWidth={2} />} />
      <Field label={t.ctaButtonText} value={content.link_text ?? ''} onChange={v => set('link_text', v)} placeholder="Shop Now" icon={<MousePointerClick size={13} color={Colors.textMuted} strokeWidth={2} />} />
      <Field label={t.buttonUrl} value={content.link_url ?? ''} onChange={v => set('link_url', v)} placeholder="https://..." icon={<Link size={13} color={Colors.textMuted} strokeWidth={2} />} />
      <SectionDivider title={t.colors} />
      <Field label={t.backgroundColor} value={content.bg_color ?? '#FF4D8D'} onChange={v => set('bg_color', v)} placeholder="#FF4D8D" icon={<Palette size={13} color={Colors.textMuted} strokeWidth={2} />} />
      <Field label={t.textColor} value={content.text_color ?? '#0A0507'} onChange={v => set('text_color', v)} placeholder="#0A0507" icon={<Palette size={13} color={Colors.textMuted} strokeWidth={2} />} />
      <View style={[styles.bannerColorPreview, { backgroundColor: content.bg_color || '#FF4D8D' }]}>
        <Text style={[styles.bannerColorPreviewText, { color: content.text_color || '#0A0507' }]}>
          {content.text || t.bannerPreviewText}
        </Text>
      </View>
    </View>
  );
}

function SectionRowInfo({ content }: { content: any }) {
  return (
    <View style={fs.sectionRowInfo}>
      <Text style={fs.sectionRowInfoTitle}>
        {content.title_en || content.title_ar || 'Product Section'}
      </Text>
      {content.title_ar ? (
        <Text style={fs.sectionRowInfoSub}>{content.title_ar}</Text>
      ) : null}
      <Text style={fs.sectionRowInfoHint}>
        This section row is managed in Admin → Home Sections.{'\n'}
        Use the eye icon to show/hide it. Use the arrows to reorder it relative to other blocks.{'\n'}
        Click Save to persist the new order.
      </Text>
    </View>
  );
}

function FooterSettings({ content, set }: { content: any; set: (k: string, v: any) => void }) {
  const { t } = useLanguage();
  return (
    <View>
      <Field label={t.tagline} value={content.tagline ?? ''} onChange={v => set('tagline', v)} placeholder="Premium beauty products for every skin type..." multiline icon={<Type size={13} color={Colors.textMuted} strokeWidth={2} />} />
      <Field label={t.copyrightText} value={content.copyright ?? ''} onChange={v => set('copyright', v)} placeholder="© 2026 Lazurde Makeup." />
      <SectionDivider title={t.contactInfo} />
      <Field label={t.email} value={content.contact_email ?? ''} onChange={v => set('contact_email', v)} placeholder="support@example.com" />
      <Field label={t.phone} value={content.contact_phone ?? ''} onChange={v => set('contact_phone', v)} placeholder="+1 (800) 555-0199" />
      <SectionDivider title={t.navigationColumns} />
      <Field label={t.column1Title} value={content.col1_title ?? ''} onChange={v => set('col1_title', v)} placeholder="Shop" />
      <Field label={t.column2Title} value={content.col2_title ?? ''} onChange={v => set('col2_title', v)} placeholder="Company" />
      <Field label={t.column3Title} value={content.col3_title ?? ''} onChange={v => set('col3_title', v)} placeholder="Support" />
    </View>
  );
}

const fs = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  hint: { color: Colors.textMuted, fontSize: 10, marginBottom: 5, lineHeight: 14 },
  inputRow: { position: 'relative' },
  inputIcon: { position: 'absolute', left: 10, top: 0, bottom: 0, justifyContent: 'center', zIndex: 1 },
  input: { backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 9, color: Colors.textPrimary, fontSize: FontSize.sm },
  inputWithIcon: { paddingLeft: 32 },
  multiline: { height: 64, textAlignVertical: 'top', paddingTop: 9 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginBottom: Spacing.sm },
  toggleLabel: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '600', flex: 1 },
  segmentRow: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.backgroundSecondary, alignItems: 'center' },
  segmentActive: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlue },
  segmentText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  segmentTextActive: { color: Colors.neonBlue },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md, marginTop: Spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  imgPreview: { width: '100%', height: 90, borderRadius: Radius.md, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border, marginBottom: 8, backgroundColor: Colors.backgroundSecondary },
  imgPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 },
  imgPlaceholderText: { color: Colors.textMuted, fontSize: 10 },
});

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  panelTitle: { flex: 1, gap: 4 },
  panelTitleText: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  blockTypeBadge: { alignSelf: 'flex-start', backgroundColor: Colors.neonBlueGlow, borderWidth: 1, borderColor: Colors.neonBlueBorder, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  blockTypeText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '800', letterSpacing: 0.5 },
  closeBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.sm, backgroundColor: Colors.backgroundSecondary },
  panelBody: { flex: 1, padding: Spacing.md },
  bannerColorPreview: { borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm, alignItems: 'center' },
  bannerColorPreviewText: { fontSize: FontSize.sm, fontWeight: '600', textAlign: 'center' },
});
