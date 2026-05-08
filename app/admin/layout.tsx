import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';

import {
  LayoutGrid,
  Smartphone,
  Monitor,
  Tablet,
  RefreshCw,
  Save,
  ChevronRight,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
  Sparkles,
  Star,
  MessageSquare,
  Megaphone,
  PanelBottom,
  Image as ImageIcon,
  User,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import MobileUnsupported from '@/components/admin/MobileUnsupported';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import {
  useLayout,
  SectionId,
  SpacingBreakpoint,
  Typography,
  LayoutOptions,
  SECTION_DEFAULTS,
} from '@/context/LayoutContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const IS_WIDE = SCREEN_W > 900;
const IS_MEDIUM = SCREEN_W > 600;

type Breakpoint = 'mobile' | 'tablet' | 'desktop';
type EditorTab = 'spacing' | 'typography' | 'layout';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SECTION_ORDER: SectionId[] = [
  'header', 'hero', 'featured', 'canopy', 'testimonials', 'banner', 'footer', 'products',
];

const SECTION_META: Record<SectionId, { icon: React.ReactNode; color: string; description: string }> = {
  header:       { icon: <User size={15} color={Colors.neonBlue} strokeWidth={2} />, color: Colors.neonBlue, description: 'App bar at the top' },
  hero:         { icon: <ImageIcon size={15} color={Colors.warning} strokeWidth={2} />, color: Colors.warning, description: 'Full-width banner' },
  featured:     { icon: <Star size={15} color={Colors.gold} strokeWidth={2} />, color: Colors.gold, description: 'Featured products grid' },
  canopy:       { icon: <Sparkles size={15} color={Colors.success} strokeWidth={2} />, color: Colors.success, description: 'Beauty filter block' },
  testimonials: { icon: <MessageSquare size={15} color='#90CAF9' strokeWidth={2} />, color: '#90CAF9', description: 'Reviews carousel' },
  banner:       { icon: <Megaphone size={15} color={Colors.error} strokeWidth={2} />, color: Colors.error, description: 'Promotional strip' },
  footer:       { icon: <PanelBottom size={15} color={Colors.textMuted} strokeWidth={2} />, color: Colors.textMuted, description: 'Footer block' },
  products:     { icon: <LayoutGrid size={15} color={Colors.textSecondary} strokeWidth={2} />, color: Colors.textSecondary, description: 'Product listing grid' },
};

// ─── Clamp helper ─────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, isNaN(val) ? min : val));
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

function LayoutAdminScreen() {
  const { isMobile } = useAdminLayout();
  const { t } = useLanguage();

  if (isMobile) {
    return (
      <AdminMobileDashboard title={t.layoutSpacing} showBack>
        <MobileUnsupported featureName="Layout & Spacing Editor" />
      </AdminMobileDashboard>
    );
  }

  return (
    <AdminWebDashboard title={t.layoutSpacing} subtitle={t.layoutSpacingSubtitle} noScroll>
      <LayoutEditor />
    </AdminWebDashboard>
  );
}

export default function LayoutAdminScreenGuarded() {
  return (
    <AdminGuard permission="manage_layout">
      <LayoutAdminScreen />
    </AdminGuard>
  );
}

function LayoutEditor() {
  const { sections, updateSection, saveSection, saveAll, resetSection, resetAll, loading, loadError, refresh } = useLayout();
  const { t } = useLanguage();
  const [selectedSection, setSelectedSection] = useState<SectionId>('hero');
  const [activeBp, setActiveBp] = useState<Breakpoint>('mobile');
  const [activeTab, setActiveTab] = useState<EditorTab>('spacing');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [sectionSaveState, setSectionSaveState] = useState<SaveState>('idle');
  const [showPreview, setShowPreview] = useState(IS_WIDE);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!IS_MEDIUM);

  const sectionDescs: Record<SectionId, string> = {
    header: t.descHeader, hero: t.descHero, featured: t.descFeatured,
    canopy: t.descCanopy, testimonials: t.descTestimonials, banner: t.descBanner,
    footer: t.descFooter, products: t.descProducts,
  };

  const section = sections[selectedSection] ?? SECTION_DEFAULTS[selectedSection];

  const handleSpacingChange = useCallback((key: keyof SpacingBreakpoint, val: number) => {
    updateSection(selectedSection, { [activeBp]: { ...section[activeBp], [key]: val } } as any);
  }, [selectedSection, activeBp, section, updateSection]);

  const handleTypographyChange = useCallback((key: keyof Typography, val: number) => {
    updateSection(selectedSection, { typography: { ...section.typography, [key]: val } });
  }, [selectedSection, section, updateSection]);

  const handleLayoutChange = useCallback((key: keyof LayoutOptions, val: any) => {
    updateSection(selectedSection, { layout: { ...section.layout, [key]: val } });
  }, [selectedSection, section, updateSection]);

  const handleSaveSection = async () => {
    setSectionSaveState('saving');
    const result = await saveSection(selectedSection);
    setSectionSaveState(result.error ? 'error' : 'saved');
    setTimeout(() => setSectionSaveState('idle'), 2800);
  };

  const handleSaveAll = async () => {
    setSaveState('saving');
    const result = await saveAll();
    setSaveState(result.error ? 'error' : 'saved');
    setTimeout(() => setSaveState('idle'), 2800);
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={Colors.neonBlue} size="large" />
        <Text style={styles.loadingText}>{t.loadingLayout}</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.loadingWrap}>
        <AlertCircle size={36} color={Colors.error} strokeWidth={1.5} />
        <Text style={[styles.loadingText, { color: Colors.error, fontWeight: '700' }]}>{t.errorLoadingLayout}</Text>
        <Text style={[styles.loadingText, { fontSize: FontSize.xs }]}>{loadError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.8}>
          <RefreshCw size={14} color={Colors.textPrimary} strokeWidth={2} />
          <Text style={styles.retryBtnText}>{t.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Top action bar ── */}
      <View style={styles.actionBar}>
        <View style={styles.actionBarLeft}>
          <TouchableOpacity
            style={styles.sidebarToggle}
            onPress={() => setSidebarCollapsed(p => !p)}
            activeOpacity={0.7}
          >
            <LayoutGrid size={14} color={Colors.neonBlue} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.pageTitle} numberOfLines={1}>{t.layoutSpacing}</Text>
        </View>

        <View style={styles.actionBarRight}>
          {IS_WIDE && (
            <TouchableOpacity
              style={[styles.previewToggle, showPreview && styles.previewToggleActive]}
              onPress={() => setShowPreview(p => !p)}
              activeOpacity={0.8}
            >
              {showPreview
                ? <Eye size={12} color={Colors.neonBlue} strokeWidth={2} />
                : <EyeOff size={12} color={Colors.textMuted} strokeWidth={2} />}
              <Text style={[styles.previewToggleText, showPreview && { color: Colors.neonBlue }]}>
                {showPreview ? t.previewOn : t.previewOff}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.resetAllBtn} onPress={() => resetAll()} activeOpacity={0.8}>
            <RefreshCw size={11} color={Colors.textMuted} strokeWidth={2} />
            <Text style={styles.resetAllText}>{t.resetAll}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveAllBtn, saveState === 'saving' && { opacity: 0.6 }]}
            onPress={handleSaveAll}
            disabled={saveState === 'saving'}
            activeOpacity={0.8}
          >
            {saveState === 'saving'
              ? <ActivityIndicator size="small" color={Colors.background} />
              : saveState === 'saved'
              ? <CheckCircle size={12} color={Colors.background} strokeWidth={2.5} />
              : saveState === 'error'
              ? <AlertCircle size={12} color={Colors.background} strokeWidth={2.5} />
              : <Save size={12} color={Colors.background} strokeWidth={2} />}
            <Text style={styles.saveAllText}>
              {saveState === 'saving' ? t.saving : saveState === 'saved' ? t.savedBang : saveState === 'error' ? t.error : t.saveAll}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Body ── */}
      <View style={styles.body}>
        {/* Section sidebar */}
        {!sidebarCollapsed && (
          <View style={[styles.sectionList, IS_MEDIUM ? styles.sectionListWide : styles.sectionListNarrow]}>
            <Text style={styles.panelTitle}>{t.sections}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {SECTION_ORDER.map(sid => {
                const meta = SECTION_META[sid];
                const isActive = sid === selectedSection;
                return (
                  <TouchableOpacity
                    key={sid}
                    style={[styles.sectionItem, isActive && styles.sectionItemActive]}
                    onPress={() => {
                      setSelectedSection(sid);
                      if (!IS_MEDIUM) setSidebarCollapsed(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.sectionIconBox, { backgroundColor: meta.color + '18', borderColor: meta.color + '40' }]}>
                      {meta.icon}
                    </View>
                    {IS_MEDIUM && (
                      <View style={styles.sectionMeta}>
                        <Text style={[styles.sectionLabel, isActive && { color: Colors.textPrimary }]} numberOfLines={1}>
                          {sections[sid]?.label ?? sid}
                        </Text>
                        <Text style={styles.sectionDesc} numberOfLines={1}>{sectionDescs[sid]}</Text>
                      </View>
                    )}
                    {isActive && IS_MEDIUM && <ChevronRight size={13} color={Colors.neonBlue} strokeWidth={2} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Controls */}
        <View style={styles.controlPanel}>
          {/* Section header row */}
          <View style={styles.controlHeader}>
            <View style={[styles.sectionIconBox, {
              backgroundColor: SECTION_META[selectedSection].color + '18',
              borderColor: SECTION_META[selectedSection].color + '40',
            }]}>
              {SECTION_META[selectedSection].icon}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.controlTitle} numberOfLines={1}>{section?.label ?? selectedSection}</Text>
              <Text style={styles.controlDesc} numberOfLines={1}>{sectionDescs[selectedSection]}</Text>
            </View>
            <TouchableOpacity style={styles.resetSectionBtn} onPress={() => resetSection(selectedSection)} activeOpacity={0.8}>
              <RefreshCw size={11} color={Colors.textMuted} strokeWidth={2} />
              {IS_MEDIUM && <Text style={styles.resetSectionText}>{t.resetSection}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveSectionBtn, sectionSaveState === 'saving' && { opacity: 0.6 }]}
              onPress={handleSaveSection}
              disabled={sectionSaveState === 'saving'}
              activeOpacity={0.8}
            >
              {sectionSaveState === 'saving'
                ? <ActivityIndicator size="small" color={Colors.background} />
                : sectionSaveState === 'saved'
                ? <CheckCircle size={12} color={Colors.background} strokeWidth={2.5} />
                : sectionSaveState === 'error'
                ? <AlertCircle size={12} color={Colors.background} strokeWidth={2.5} />
                : <Save size={12} color={Colors.background} strokeWidth={2} />}
              {IS_MEDIUM && (
                <Text style={styles.saveSectionText}>
                  {sectionSaveState === 'saving' ? t.saving : sectionSaveState === 'saved' ? t.savedBang : sectionSaveState === 'error' ? t.error : t.saveSection}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Breakpoint + Tab row */}
          <View style={styles.bpTabRow}>
            <View style={styles.bpGroup}>
              {(['mobile', 'tablet', 'desktop'] as Breakpoint[]).map(bp => (
                <TouchableOpacity
                  key={bp}
                  style={[styles.bpChip, activeBp === bp && styles.bpChipActive]}
                  onPress={() => setActiveBp(bp)}
                  activeOpacity={0.7}
                >
                  {bp === 'mobile' && <Smartphone size={11} color={activeBp === bp ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />}
                  {bp === 'tablet' && <Tablet size={11} color={activeBp === bp ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />}
                  {bp === 'desktop' && <Monitor size={11} color={activeBp === bp ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />}
                  {IS_MEDIUM && (
                    <Text style={[styles.bpChipText, activeBp === bp && styles.bpChipTextActive]}>
                      {bp === 'mobile' ? t.mobile : bp === 'tablet' ? t.tablet : t.desktop}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.editorTabGroup}>
              {(['spacing', 'typography', 'layout'] as EditorTab[]).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.editorTab, activeTab === tab && styles.editorTabActive]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.editorTabText, activeTab === tab && styles.editorTabTextActive]}>
                    {tab === 'spacing' ? (IS_MEDIUM ? t.spacing : t.spacing.slice(0,3).toUpperCase()) : tab === 'typography' ? (IS_MEDIUM ? t.typography : t.typography.slice(0,3).toUpperCase()) : (IS_MEDIUM ? t.layout : t.layout.slice(0,3).toUpperCase())}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Controls + optional preview */}
          <View style={styles.editorBody}>
            <ScrollView style={styles.controlScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {activeTab === 'spacing' && (
                <SpacingControls
                  values={section[activeBp]}
                  defaults={SECTION_DEFAULTS[selectedSection][activeBp]}
                  onChange={handleSpacingChange}
                />
              )}
              {activeTab === 'typography' && (
                <TypographyControls
                  values={section.typography}
                  defaults={SECTION_DEFAULTS[selectedSection].typography}
                  onChange={handleTypographyChange}
                />
              )}
              {activeTab === 'layout' && (
                <LayoutControls
                  values={section.layout}
                  sectionId={selectedSection}
                  defaults={SECTION_DEFAULTS[selectedSection].layout}
                  onChange={handleLayoutChange}
                />
              )}
              <View style={{ height: 40 }} />
            </ScrollView>

            {showPreview && IS_WIDE && (
              <LivePreview sectionId={selectedSection} />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Live Preview Panel ───────────────────────────────────────────────────────

function LivePreview({ sectionId }: { sectionId: SectionId }) {
  const { getSectionLayout } = useLayout();
  const { t } = useLanguage();
  const section = getSectionLayout(sectionId);
  const sp = section.mobile;
  const ty = section.typography;
  const lo = section.layout;
  const meta = SECTION_META[sectionId];

  const alignItems = lo.alignment === 'center' ? 'center' : lo.alignment === 'right' ? 'flex-end' : 'flex-start';

  return (
    <View style={preview.panel}>
      <Text style={preview.panelTitle}>{t.livePreview}</Text>
      <Text style={preview.panelSub}>Mobile · {section.label}</Text>

      <View style={preview.phoneFrame}>
        <View style={preview.phoneTop}>
          <View style={preview.phoneCam} />
        </View>
        <ScrollView style={preview.phoneScreen} showsVerticalScrollIndicator={false}>
          {/* Section mock */}
          <View style={[preview.sectionMock, {
            marginTop: Math.min(sp.marginTop, 30),
            marginBottom: Math.min(sp.marginBottom, 30),
            paddingTop: Math.min(sp.paddingTop, 40),
            paddingBottom: Math.min(sp.paddingBottom, 40),
            paddingLeft: Math.min(sp.paddingLeft, 24),
            paddingRight: Math.min(sp.paddingRight, 24),
            borderRadius: sp.borderRadius,
            backgroundColor: sectionId === 'hero'
              ? '#140A10'
              : sectionId === 'canopy'
              ? '#0D1F2D'
              : sectionId === 'banner'
              ? Colors.neonBlue + '22'
              : Colors.backgroundCard,
            borderWidth: 1,
            borderColor: meta.color + '30',
          }]}>
            <View style={{ alignItems }}>
              {sectionId === 'hero' && (
                <View style={[preview.heroBadge]}>
                  <Text style={{ color: Colors.neonBlue, fontSize: 7, fontWeight: '800', letterSpacing: 1.5 }}>PROFESSIONAL</Text>
                </View>
              )}
              <Text style={[preview.headingMock, {
                fontSize: Math.min(ty.headingSize * 0.55, 16),
                marginBottom: Math.min(ty.headingMarginBottom * 0.55, 8),
                textAlign: lo.alignment as any,
                color: sectionId === 'hero' ? Colors.white : Colors.textPrimary,
              }]}>
                {sectionId === 'hero' ? 'Hero Title\nSection' : sectionId === 'canopy' ? 'Beauty Filter' : sectionId === 'testimonials' ? 'What People Say' : section.label}
              </Text>
              <Text style={[preview.subtitleMock, {
                fontSize: Math.min(ty.subtitleSize * 0.55, 9),
                marginBottom: Math.min(ty.subtitleMarginBottom * 0.55, 6),
                textAlign: lo.alignment as any,
              }]}>
                {sectionId === 'hero' ? 'Loved by beauty enthusiasts' : 'Subtitle text preview here'}
              </Text>

              {(sectionId === 'hero' || sectionId === 'canopy') && (
                <View style={[preview.btnMock, {
                  paddingHorizontal: Math.min(ty.buttonPaddingH * 0.5, 16),
                  paddingVertical: Math.min(ty.buttonPaddingV * 0.5, 8),
                }]}>
                  <Text style={{ color: Colors.background, fontSize: Math.min(ty.buttonSize * 0.5, 8), fontWeight: '800' }}>
                    {sectionId === 'canopy' ? 'Try Now' : 'Shop Now'}
                  </Text>
                </View>
              )}

              {(sectionId === 'featured' || sectionId === 'products') && (
                <View style={[preview.gridMock, { gap: Math.min((lo.cardGap ?? 4) * 0.5, 6) }]}>
                  {Array.from({ length: lo.gridColumns ?? 2 }).map((_, i) => (
                    <View key={i} style={[preview.gridCard, {
                      flex: 1,
                      borderRadius: Math.min(sp.borderRadius || 6, 8),
                    }]} />
                  ))}
                </View>
              )}

              {sectionId === 'testimonials' && (
                <View style={preview.testimonialsRow}>
                  {[1, 2].map(i => (
                    <View key={i} style={[preview.testimonialCard, {
                      width: Math.min((lo.contentWidth ?? 120) * 0.4, 70),
                    }]}>
                      <View style={preview.stars}>
                        {[1,2,3,4,5].map(s => <View key={s} style={preview.star} />)}
                      </View>
                      <View style={preview.reviewLine} />
                      <View style={[preview.reviewLine, { width: '60%' }]} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Spacing indicators */}
          <View style={preview.spacingInfo}>
            <SpacingBadge label="PT" value={sp.paddingTop} />
            <SpacingBadge label="PB" value={sp.paddingBottom} />
            <SpacingBadge label="PL" value={sp.paddingLeft} />
            <SpacingBadge label="PR" value={sp.paddingRight} />
            {sp.borderRadius > 0 && <SpacingBadge label="BR" value={sp.borderRadius} />}
          </View>

          <View style={preview.typographyInfo}>
            <SpacingBadge label={`H ${ty.headingSize}px`} value={null} color={Colors.gold} />
            <SpacingBadge label={`S ${ty.subtitleSize}px`} value={null} color={Colors.success} />
            <SpacingBadge label={`B ${ty.buttonSize}px`} value={null} color={Colors.neonBlue} />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function SpacingBadge({ label, value, color }: { label: string; value: number | null; color?: string }) {
  return (
    <View style={[preview.badge, color && { backgroundColor: color + '22', borderColor: color + '50' }]}>
      <Text style={[preview.badgeText, color && { color }]}>
        {value !== null ? `${label}: ${value}` : label}
      </Text>
    </View>
  );
}

// ─── Spacing Controls ─────────────────────────────────────────────────────────

function SpacingControls({
  values, defaults, onChange,
}: { values: SpacingBreakpoint; defaults: SpacingBreakpoint; onChange: (k: keyof SpacingBreakpoint, v: number) => void }) {
  return (
    <View style={ctrl.wrap}>
      <ControlGroup label="Margin">
        <ControlRow label="Top" glyph="↑" value={values.marginTop} min={0} max={120} step={4} defaultVal={defaults.marginTop} hint="px" onChange={v => onChange('marginTop', v)} />
        <ControlRow label="Bottom" glyph="↓" value={values.marginBottom} min={0} max={120} step={4} defaultVal={defaults.marginBottom} hint="px" onChange={v => onChange('marginBottom', v)} />
      </ControlGroup>
      <ControlGroup label="Padding">
        <ControlRow label="Top" glyph="↑" value={values.paddingTop} min={0} max={120} step={4} defaultVal={defaults.paddingTop} hint="px" onChange={v => onChange('paddingTop', v)} />
        <ControlRow label="Bottom" glyph="↓" value={values.paddingBottom} min={0} max={120} step={4} defaultVal={defaults.paddingBottom} hint="px" onChange={v => onChange('paddingBottom', v)} />
        <ControlRow label="Left" glyph="←" value={values.paddingLeft} min={0} max={80} step={4} defaultVal={defaults.paddingLeft} hint="px" onChange={v => onChange('paddingLeft', v)} />
        <ControlRow label="Right" glyph="→" value={values.paddingRight} min={0} max={80} step={4} defaultVal={defaults.paddingRight} hint="px" onChange={v => onChange('paddingRight', v)} />
      </ControlGroup>
      <ControlGroup label="Shape">
        <ControlRow label="Max Width" glyph="↔" value={values.maxWidth} min={0} max={1600} step={40} defaultVal={defaults.maxWidth} hint={values.maxWidth === 0 ? 'Full' : 'px'} onChange={v => onChange('maxWidth', v)} />
        <ControlRow label="Border Radius" glyph="⌒" value={values.borderRadius} min={0} max={64} step={4} defaultVal={defaults.borderRadius} hint="px" onChange={v => onChange('borderRadius', v)} />
      </ControlGroup>
    </View>
  );
}

// ─── Typography Controls ──────────────────────────────────────────────────────

function TypographyControls({
  values, defaults, onChange,
}: { values: Typography; defaults: Typography; onChange: (k: keyof Typography, v: number) => void }) {
  return (
    <View style={ctrl.wrap}>
      <ControlGroup label="Heading">
        <ControlRow label="Font Size" glyph="A" value={values.headingSize} min={10} max={64} step={1} defaultVal={defaults.headingSize} hint="px" onChange={v => onChange('headingSize', v)} />
        <ControlRow label="Margin Below" glyph="↓" value={values.headingMarginBottom} min={0} max={48} step={2} defaultVal={defaults.headingMarginBottom} hint="px" onChange={v => onChange('headingMarginBottom', v)} />
      </ControlGroup>
      <ControlGroup label="Subtitle">
        <ControlRow label="Font Size" glyph="a" value={values.subtitleSize} min={9} max={32} step={1} defaultVal={defaults.subtitleSize} hint="px" onChange={v => onChange('subtitleSize', v)} />
        <ControlRow label="Margin Below" glyph="↓" value={values.subtitleMarginBottom} min={0} max={48} step={2} defaultVal={defaults.subtitleMarginBottom} hint="px" onChange={v => onChange('subtitleMarginBottom', v)} />
      </ControlGroup>
      <ControlGroup label="Button">
        <ControlRow label="Font Size" glyph="T" value={values.buttonSize} min={9} max={24} step={1} defaultVal={defaults.buttonSize} hint="px" onChange={v => onChange('buttonSize', v)} />
        <ControlRow label="Padding H" glyph="↔" value={values.buttonPaddingH} min={4} max={64} step={2} defaultVal={defaults.buttonPaddingH} hint="px" onChange={v => onChange('buttonPaddingH', v)} />
        <ControlRow label="Padding V" glyph="↕" value={values.buttonPaddingV} min={2} max={32} step={2} defaultVal={defaults.buttonPaddingV} hint="px" onChange={v => onChange('buttonPaddingV', v)} />
      </ControlGroup>
      <ControlGroup label="Cards">
        <ControlRow label="Card Gap" glyph="⋮" value={values.cardGap} min={0} max={40} step={2} defaultVal={defaults.cardGap} hint="px" onChange={v => onChange('cardGap', v)} />
      </ControlGroup>
    </View>
  );
}

// ─── Layout Controls ──────────────────────────────────────────────────────────

function LayoutControls({
  values, sectionId, defaults, onChange,
}: { values: LayoutOptions; sectionId: SectionId; defaults: LayoutOptions; onChange: (k: keyof LayoutOptions, v: any) => void }) {
  return (
    <View style={ctrl.wrap}>
      <ControlGroup label="Alignment">
        <AlignmentPicker
          value={values.alignment}
          defaultVal={defaults.alignment}
          onChange={v => onChange('alignment', v)}
        />
      </ControlGroup>

      {sectionId === 'hero' && (
        <ControlGroup label="Hero">
          <ControlRow label="Hero Height" glyph="↕" value={values.heroHeight} min={100} max={600} step={10} defaultVal={defaults.heroHeight} hint="px" onChange={v => onChange('heroHeight', v)} />
          <ControlRow label="Content Width %" glyph="↔" value={clamp(values.contentWidth, 30, 100)} min={30} max={100} step={5} defaultVal={clamp(defaults.contentWidth, 30, 100)} hint="%" onChange={v => onChange('contentWidth', v)} />
        </ControlGroup>
      )}

      {(sectionId === 'featured' || sectionId === 'products') && (
        <ControlGroup label="Grid">
          <ControlRow label="Columns" glyph="#" value={clamp(values.gridColumns ?? 2, 1, 4)} min={1} max={4} step={1} defaultVal={defaults.gridColumns ?? 2} hint="col" onChange={v => onChange('gridColumns', v)} />
          <ControlRow label="Card Gap" glyph="⋮" value={clamp(values.cardGap ?? 8, 0, 32)} min={0} max={32} step={2} defaultVal={defaults.cardGap ?? 8} hint="px" onChange={v => onChange('cardGap', v)} />
          <ControlRow label="Aspect Ratio" glyph="▭" value={clamp(values.imageAspectRatio, 0.5, 2)} min={0.5} max={2} step={0.1} defaultVal={clamp(defaults.imageAspectRatio, 0.5, 2)} hint={`${clamp(values.imageAspectRatio, 0.5, 2).toFixed(1)}:1`} onChange={v => onChange('imageAspectRatio', parseFloat(v.toFixed(2)))} />
        </ControlGroup>
      )}

      {sectionId === 'testimonials' && (
        <ControlGroup label="Carousel Cards">
          <ControlRow label="Card Width" glyph="↔" value={clamp(values.contentWidth, 120, 400)} min={120} max={400} step={10} defaultVal={clamp(defaults.contentWidth, 120, 400)} hint="px" onChange={v => onChange('contentWidth', v)} />
          <ControlRow label="Card Gap" glyph="⋮" value={clamp(values.cardGap ?? 8, 0, 32)} min={0} max={32} step={2} defaultVal={defaults.cardGap ?? 8} hint="px" onChange={v => onChange('cardGap', v)} />
        </ControlGroup>
      )}

      {sectionId === 'footer' && (
        <ControlGroup label="Footer Grid">
          <ControlRow label="Columns" glyph="#" value={clamp(values.gridColumns ?? 3, 1, 4)} min={1} max={4} step={1} defaultVal={defaults.gridColumns ?? 3} hint="col" onChange={v => onChange('gridColumns', v)} />
        </ControlGroup>
      )}

      {sectionId !== 'hero' && sectionId !== 'testimonials' && (
        <ControlGroup label="Content Width">
          <ControlRow label="Max Width %" glyph="↔" value={clamp(values.contentWidth <= 100 ? values.contentWidth : 100, 40, 100)} min={40} max={100} step={5} defaultVal={100} hint="%" onChange={v => onChange('contentWidth', v)} />
        </ControlGroup>
      )}
    </View>
  );
}

// ─── Alignment Picker ─────────────────────────────────────────────────────────

function AlignmentPicker({ value, defaultVal, onChange }: {
  value: string; defaultVal: string; onChange: (v: 'left' | 'center' | 'right') => void;
}) {
  const opts: { id: 'left' | 'center' | 'right'; label: string; glyph: string }[] = [
    { id: 'left', label: 'Left', glyph: '⬛◻◻' },
    { id: 'center', label: 'Center', glyph: '◻⬛◻' },
    { id: 'right', label: 'Right', glyph: '◻◻⬛' },
  ];
  const isDefault = value === defaultVal;
  return (
    <View>
      <View style={ctrl.alignRow}>
        {opts.map(opt => (
          <TouchableOpacity
            key={opt.id}
            style={[ctrl.alignBtn, value === opt.id && ctrl.alignBtnActive]}
            onPress={() => onChange(opt.id)}
            activeOpacity={0.7}
          >
            <Text style={[ctrl.alignGlyph, value === opt.id && { color: Colors.neonBlue }]}>{opt.glyph}</Text>
            <Text style={[ctrl.alignBtnText, value === opt.id && ctrl.alignBtnTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {!isDefault && (
        <TouchableOpacity style={ctrl.alignReset} onPress={() => onChange(defaultVal as any)} activeOpacity={0.7}>
          <Text style={ctrl.alignResetText}>↺ Reset to default ({defaultVal})</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Control Group ────────────────────────────────────────────────────────────

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={ctrl.group}>
      <Text style={ctrl.groupLabel}>{label}</Text>
      <View style={ctrl.groupInner}>{children}</View>
    </View>
  );
}

// ─── Control Row ──────────────────────────────────────────────────────────────

function ControlRow({
  label, glyph, value, min, max, step, defaultVal, hint, onChange,
}: {
  label: string; glyph: string; value: number;
  min: number; max: number; step: number;
  defaultVal: number; hint?: string; onChange: (v: number) => void;
}) {
  const [inputVal, setInputVal] = useState(String(value));
  const isDefault = value === defaultVal;

  const commit = useCallback((raw: string) => {
    const n = parseFloat(raw);
    const clamped = clamp(isNaN(n) ? defaultVal : n, min, max);
    setInputVal(String(clamped));
    onChange(clamped);
  }, [min, max, defaultVal, onChange]);

  React.useEffect(() => {
    setInputVal(String(value));
  }, [value]);

  const step_ = (dir: 1 | -1) => {
    const next = clamp(value + dir * step, min, max);
    onChange(next);
    setInputVal(String(next));
  };

  return (
    <View style={ctrl.row}>
      <View style={ctrl.rowTop}>
        <View style={ctrl.rowLabelRow}>
          <Text style={ctrl.rowGlyph}>{glyph}</Text>
          <Text style={ctrl.rowLabelText}>{label}</Text>
          {!isDefault && (
            <TouchableOpacity
              onPress={() => { onChange(defaultVal); setInputVal(String(defaultVal)); }}
              style={ctrl.resetPill}
              activeOpacity={0.7}
            >
              <Text style={ctrl.resetPillText}>↺ reset</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={ctrl.rowValueRow}>
          <Text style={[ctrl.valueDisplay, !isDefault && { color: Colors.neonBlue }]}>
            {value}{hint ? ' ' + hint : ''}
          </Text>
          <View style={ctrl.stepper}>
            <TouchableOpacity style={ctrl.stepBtn} onPress={() => step_(-1)} activeOpacity={0.7}>
              <Text style={ctrl.stepText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={ctrl.numInput}
              value={inputVal}
              onChangeText={setInputVal}
              onBlur={() => commit(inputVal)}
              onSubmitEditing={() => commit(inputVal)}
              keyboardType="numeric"
              selectTextOnFocus
              returnKeyType="done"
            />
            <TouchableOpacity style={ctrl.stepBtn} onPress={() => step_(1)} activeOpacity={0.7}>
              <Text style={ctrl.stepText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {Platform.OS === 'web' ? (
        <View style={ctrl.sliderWrap}>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => {
              const v = parseFloat(e.target.value);
              onChange(v);
              setInputVal(String(v));
            }}
            style={{
              width: '100%',
              accentColor: isDefault ? Colors.textMuted : Colors.neonBlue,
              height: 4,
              cursor: 'pointer',
              borderRadius: 2,
            }}
          />
          <View style={ctrl.sliderMarks}>
            <Text style={ctrl.sliderMark}>{min}</Text>
            <Text style={ctrl.sliderMark}>{max}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ─── Preview styles ───────────────────────────────────────────────────────────

const preview = StyleSheet.create({
  panel: {
    width: 220,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    padding: Spacing.sm,
  },
  panelTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  panelSub: {
    color: Colors.textMuted,
    fontSize: 9,
    marginBottom: Spacing.sm,
  },
  phoneFrame: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    flex: 1,
    maxHeight: 460,
  },
  phoneTop: {
    height: 20,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  phoneCam: {
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  phoneScreen: { flex: 1 },

  sectionMock: { margin: 6 },

  heroBadge: {
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  headingMock: {
    color: Colors.textPrimary,
    fontWeight: '800',
    lineHeight: 14,
    marginBottom: 4,
  },
  subtitleMock: {
    color: Colors.textMuted,
    lineHeight: 10,
    marginBottom: 4,
  },
  btnMock: {
    backgroundColor: Colors.neonBlue,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  gridMock: {
    flexDirection: 'row',
    marginTop: 6,
  },
  gridCard: {
    height: 40,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 20,
  },
  testimonialsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  testimonialCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 4,
    padding: 5,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 40,
  },
  stars: { flexDirection: 'row', gap: 1, marginBottom: 4 },
  star: { width: 4, height: 4, borderRadius: 1, backgroundColor: Colors.gold },
  reviewLine: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 1,
    width: '100%',
    marginBottom: 2,
  },

  spacingInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    padding: 6,
    paddingBottom: 0,
  },
  typographyInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    padding: 6,
  },
  badge: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  badgeText: {
    color: Colors.textMuted,
    fontSize: 7,
    fontWeight: '700',
  },
});

// ─── Control Styles ───────────────────────────────────────────────────────────

const ctrl = StyleSheet.create({
  wrap: { padding: Spacing.sm, paddingBottom: 0 },

  group: { marginBottom: Spacing.md },
  groupLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  groupInner: { gap: 4 },

  row: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowTop: {},
  rowLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  rowGlyph: {
    color: Colors.textMuted,
    fontSize: 11,
    width: 14,
    textAlign: 'center',
    fontWeight: '700',
  },
  rowLabelText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  resetPill: {
    backgroundColor: Colors.neonBlueGlow,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
  },
  resetPillText: {
    color: Colors.neonBlue,
    fontSize: 8,
    fontWeight: '800',
  },
  rowValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  valueDisplay: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stepBtn: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
    includeFontPadding: false,
  },
  numInput: {
    width: 44,
    height: 22,
    backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
  },

  sliderWrap: { marginTop: 2 },
  sliderMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 1,
  },
  sliderMark: {
    color: Colors.textMuted,
    fontSize: 8,
  },

  alignRow: {
    flexDirection: 'row',
    gap: 5,
  },
  alignBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingVertical: 8,
  },
  alignBtnActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlue,
  },
  alignGlyph: {
    color: Colors.textMuted,
    fontSize: 9,
    letterSpacing: 1,
  },
  alignBtnText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  alignBtnTextActive: {
    color: Colors.neonBlue,
  },
  alignReset: {
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  alignResetText: {
    color: Colors.neonBlue,
    fontSize: 9,
    fontWeight: '700',
  },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryBtnText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    gap: 8,
  },
  actionBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  actionBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sidebarToggle: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.neonBlueGlow,
    borderWidth: 1,
    borderColor: Colors.neonBlueBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '800',
    flex: 1,
  },
  previewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  previewToggleActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlueBorder,
  },
  previewToggleText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  resetAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  resetAllText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  saveAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 80,
    justifyContent: 'center',
  },
  saveAllText: {
    color: Colors.background,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },

  body: {
    flex: 1,
    flexDirection: 'row',
  },

  sectionList: {
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
    padding: Spacing.xs,
  },
  sectionListWide: {
    width: 210,
  },
  sectionListNarrow: {
    width: 52,
  },
  panelTitle: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    marginBottom: 6,
    marginTop: 4,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 7,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sectionItemActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlueBorder,
  },
  sectionIconBox: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    flexShrink: 0,
  },
  sectionMeta: { flex: 1, minWidth: 0 },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  sectionDesc: {
    color: Colors.textMuted,
    fontSize: 9,
    marginTop: 1,
  },

  controlPanel: {
    flex: 1,
    backgroundColor: Colors.background,
    minWidth: 0,
  },
  controlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
  },
  controlTitle: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  controlDesc: {
    color: Colors.textMuted,
    fontSize: 9,
    marginTop: 1,
  },
  resetSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  resetSectionText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  saveSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.neonBlue,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 36,
    justifyContent: 'center',
  },
  saveSectionText: {
    color: Colors.background,
    fontSize: FontSize.xs,
    fontWeight: '800',
  },

  bpTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
    gap: 6,
  },
  bpGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  bpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  bpChipActive: {
    backgroundColor: Colors.neonBlueGlow,
    borderColor: Colors.neonBlue,
  },
  bpChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  bpChipTextActive: {
    color: Colors.neonBlue,
  },
  editorTabGroup: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  editorTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.backgroundCard,
  },
  editorTabActive: {
    backgroundColor: Colors.neonBlue,
  },
  editorTabText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  editorTabTextActive: {
    color: Colors.background,
  },

  editorBody: {
    flex: 1,
    flexDirection: 'row',
  },
  controlScroll: {
    flex: 1,
  },
});
