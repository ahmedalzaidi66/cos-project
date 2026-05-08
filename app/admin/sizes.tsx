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
import { Smartphone, Monitor, Tablet, RefreshCw, Save, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Maximize2, LayoutGrid as Layout, Search, ListFilter as Filter, Grid3x2 as Grid3X3, Navigation, Globe } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import MobileUnsupported from '@/components/admin/MobileUnsupported';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import {
  useUISize,
  CategoryId,
  CATEGORY_DEFAULTS,
} from '@/context/UISizeContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const IS_WIDE = SCREEN_W > 900;
const IS_MEDIUM = SCREEN_W > 600;

type Breakpoint = 'mobile' | 'tablet' | 'desktop';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const CATEGORY_ORDER: CategoryId[] = ['global', 'header', 'search', 'filter', 'product_card', 'bottom_nav'];

type FieldDef = { key: string; label: string; glyph: string; min: number; max: number; step: number; hint?: string };

const CATEGORY_FIELDS: Record<CategoryId, { group: string; fields: FieldDef[] }[]> = {
  global: [
    {
      group: 'Page Layout',
      fields: [
        { key: 'pageMaxWidth',       label: 'Page Max Width',       glyph: '↔', min: 0,    max: 1920, step: 40,  hint: 'px (0=full)' },
        { key: 'horizontalPadding',  label: 'Horizontal Padding',   glyph: '←', min: 0,    max: 80,   step: 4,   hint: 'px' },
        { key: 'verticalSpacing',    label: 'Vertical Spacing',     glyph: '↕', min: 0,    max: 80,   step: 4,   hint: 'px' },
        { key: 'sectionGap',         label: 'Section Gap',          glyph: '⋮', min: 0,    max: 120,  step: 4,   hint: 'px' },
      ],
    },
    {
      group: 'Visual Style',
      fields: [
        { key: 'borderRadiusScale',  label: 'Border Radius Scale',  glyph: '⌒', min: 0,    max: 3,    step: 0.1, hint: 'x' },
        { key: 'shadowIntensity',    label: 'Shadow Intensity',     glyph: '◉', min: 0,    max: 2,    step: 0.1, hint: 'x' },
        { key: 'buttonRadius',       label: 'Button Radius',        glyph: '⌒', min: 0,    max: 64,   step: 2,   hint: 'px' },
        { key: 'cardRadius',         label: 'Card Radius',          glyph: '⌒', min: 0,    max: 64,   step: 2,   hint: 'px' },
      ],
    },
  ],
  header: [
    {
      group: 'Header Size',
      fields: [
        { key: 'headerHeight',   label: 'Header Height',    glyph: '↕', min: 48,  max: 160, step: 4,  hint: 'px' },
        { key: 'paddingLeft',    label: 'Padding Left',     glyph: '←', min: 0,   max: 80,  step: 4,  hint: 'px' },
        { key: 'paddingRight',   label: 'Padding Right',    glyph: '→', min: 0,   max: 80,  step: 4,  hint: 'px' },
      ],
    },
    {
      group: 'Logo',
      fields: [
        { key: 'logoWidth',      label: 'Logo Width',       glyph: '↔', min: 40,  max: 300, step: 4,  hint: 'px' },
        { key: 'logoHeight',     label: 'Logo Height',      glyph: '↕', min: 16,  max: 80,  step: 2,  hint: 'px' },
      ],
    },
    {
      group: 'Icons',
      fields: [
        { key: 'iconSize',       label: 'Icon Size',        glyph: '◈', min: 14,  max: 40,  step: 2,  hint: 'px' },
        { key: 'langSwitchSize', label: 'Language Switch',  glyph: '⚐', min: 14,  max: 40,  step: 2,  hint: 'px' },
        { key: 'menuBtnSize',    label: 'Menu Button',      glyph: '☰', min: 14,  max: 40,  step: 2,  hint: 'px' },
      ],
    },
  ],
  search: [
    {
      group: 'Search Bar',
      fields: [
        { key: 'barWidth',    label: 'Bar Width %',    glyph: '↔', min: 30,  max: 100, step: 5,  hint: '%' },
        { key: 'barHeight',   label: 'Bar Height',     glyph: '↕', min: 28,  max: 80,  step: 2,  hint: 'px' },
        { key: 'borderRadius', label: 'Border Radius', glyph: '⌒', min: 0,   max: 40,  step: 2,  hint: 'px' },
      ],
    },
    {
      group: 'Typography & Margins',
      fields: [
        { key: 'iconSize',    label: 'Icon Size',      glyph: '◈', min: 10,  max: 32,  step: 1,  hint: 'px' },
        { key: 'fontSize',    label: 'Font Size',      glyph: 'A', min: 10,  max: 24,  step: 1,  hint: 'px' },
        { key: 'marginTop',   label: 'Margin Top',     glyph: '↑', min: 0,   max: 48,  step: 2,  hint: 'px' },
        { key: 'marginBottom', label: 'Margin Bottom', glyph: '↓', min: 0,   max: 48,  step: 2,  hint: 'px' },
      ],
    },
  ],
  filter: [
    {
      group: 'Filter Buttons',
      fields: [
        { key: 'buttonHeight', label: 'Button Height',  glyph: '↕', min: 20,  max: 64,  step: 2,  hint: 'px' },
        { key: 'paddingH',     label: 'Padding H',      glyph: '↔', min: 4,   max: 40,  step: 2,  hint: 'px' },
        { key: 'paddingV',     label: 'Padding V',      glyph: '↕', min: 2,   max: 24,  step: 2,  hint: 'px' },
        { key: 'fontSize',     label: 'Font Size',      glyph: 'A', min: 9,   max: 20,  step: 1,  hint: 'px' },
        { key: 'gap',          label: 'Gap Between',    glyph: '⋮', min: 0,   max: 24,  step: 2,  hint: 'px' },
        { key: 'borderRadius', label: 'Border Radius',  glyph: '⌒', min: 0,   max: 40,  step: 2,  hint: 'px' },
      ],
    },
  ],
  product_card: [
    {
      group: 'Grid Layout',
      fields: [
        { key: 'columns',     label: 'Columns',         glyph: '#', min: 1,   max: 6,   step: 1,  hint: 'col' },
        { key: 'cardGap',     label: 'Card Gap',        glyph: '⋮', min: 0,   max: 40,  step: 2,  hint: 'px' },
      ],
    },
    {
      group: 'Card Dimensions',
      fields: [
        { key: 'imageHeight',  label: 'Image Height',   glyph: '↕', min: 80,  max: 400, step: 8,  hint: 'px' },
        { key: 'cardPadding',  label: 'Card Padding',   glyph: '⌧', min: 0,   max: 40,  step: 2,  hint: 'px' },
      ],
    },
    {
      group: 'Typography',
      fields: [
        { key: 'titleFontSize',      label: 'Title Font Size',       glyph: 'T', min: 9, max: 24, step: 1, hint: 'px' },
        { key: 'priceFontSize',      label: 'Price Font Size',       glyph: '$', min: 9, max: 28, step: 1, hint: 'px' },
        { key: 'ratingFontSize',     label: 'Rating Font Size',      glyph: '★', min: 8, max: 20, step: 1, hint: 'px' },
        { key: 'addToCartBtnSize',   label: 'Add-to-Cart Font Size', glyph: '+', min: 9, max: 20, step: 1, hint: 'px' },
      ],
    },
  ],
  bottom_nav: [
    {
      group: 'Navigation Bar',
      fields: [
        { key: 'navHeight',     label: 'Nav Height',       glyph: '↕', min: 44,  max: 120, step: 4,  hint: 'px' },
        { key: 'iconSize',      label: 'Icon Size',        glyph: '◈', min: 14,  max: 40,  step: 2,  hint: 'px' },
        { key: 'labelFontSize', label: 'Label Font Size',  glyph: 'A', min: 8,   max: 16,  step: 1,  hint: 'px' },
        { key: 'borderTopWidth', label: 'Top Border',      glyph: '—', min: 0,   max: 4,   step: 0.5, hint: 'px' },
        { key: 'itemSpacing',   label: 'Item Spacing',     glyph: '⋮', min: 0,   max: 40,  step: 2,  hint: 'px' },
      ],
    },
  ],
};

const CATEGORY_META: Record<CategoryId, { icon: React.ReactNode; color: string; description: string }> = {
  global:       { icon: <Globe size={15} color={Colors.neonBlue} strokeWidth={2} />,       color: Colors.neonBlue,    description: 'Page-wide sizing & spacing' },
  header:       { icon: <Layout size={15} color={Colors.warning} strokeWidth={2} />,        color: Colors.warning,     description: 'App header & logo' },
  search:       { icon: <Search size={15} color={Colors.success} strokeWidth={2} />,        color: Colors.success,     description: 'Search input bar' },
  filter:       { icon: <Filter size={15} color={Colors.gold} strokeWidth={2} />,           color: Colors.gold,        description: 'Category filter chips' },
  product_card: { icon: <Grid3X3 size={15} color='#90CAF9' strokeWidth={2} />,              color: '#90CAF9',          description: 'Product grid & cards' },
  bottom_nav:   { icon: <Navigation size={15} color={Colors.textSecondary} strokeWidth={2} />, color: Colors.textSecondary, description: 'Bottom tab navigation' },
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

function UISizesScreen() {
  const { isMobile } = useAdminLayout();
  const { t } = useLanguage();

  if (isMobile) {
    return (
      <AdminMobileDashboard title={t.uiSizes} showBack>
        <MobileUnsupported featureName="UI Size Manager" />
      </AdminMobileDashboard>
    );
  }

  return (
    <AdminWebDashboard title={t.uiSizes} subtitle={t.uiSizesSubtitle} noScroll>
      <SizeEditor />
    </AdminWebDashboard>
  );
}

export default function UISizesScreenGuarded() {
  return (
    <AdminGuard permission="manage_layout">
      <UISizesScreen />
    </AdminGuard>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function SizeEditor() {
  const { categories, updateCategory, saveCategory, saveAll, resetCategory, resetAll, loading, loadError, refresh } = useUISize();
  const { t } = useLanguage();
  const [selectedCat, setSelectedCat] = useState<CategoryId>('global');
  const [activeBp, setActiveBp] = useState<Breakpoint>('mobile');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [catSaveState, setCatSaveState] = useState<SaveState>('idle');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!IS_MEDIUM);

  const cat = categories[selectedCat];
  const bpValues = cat[activeBp] as Record<string, number>;
  const defaultBpValues = CATEGORY_DEFAULTS[selectedCat][activeBp] as Record<string, number>;

  const handleChange = useCallback((key: string, val: number) => {
    updateCategory(selectedCat, activeBp, { [key]: val });
  }, [selectedCat, activeBp, updateCategory]);

  const handleSaveCat = async () => {
    setCatSaveState('saving');
    const result = await saveCategory(selectedCat);
    setCatSaveState(result.error ? 'error' : 'saved');
    setTimeout(() => setCatSaveState('idle'), 2800);
  };

  const handleSaveAll = async () => {
    setSaveState('saving');
    const result = await saveAll();
    setSaveState(result.error ? 'error' : 'saved');
    setTimeout(() => setSaveState('idle'), 2800);
  };

  if (loading) {
    return (
      <View style={styles.stateWrap}>
        <ActivityIndicator color={Colors.neonBlue} size="large" />
        <Text style={styles.stateText}>{t.loadingSizes}</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.stateWrap}>
        <AlertCircle size={36} color={Colors.error} strokeWidth={1.5} />
        <Text style={[styles.stateText, { color: Colors.error, fontWeight: '700' }]}>{t.errorLoadingSizes}</Text>
        <Text style={[styles.stateText, { fontSize: FontSize.xs }]}>{loadError}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.8}>
          <RefreshCw size={14} color={Colors.textPrimary} strokeWidth={2} />
          <Text style={styles.retryBtnText}>{t.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const fieldGroups = CATEGORY_FIELDS[selectedCat];
  const meta = CATEGORY_META[selectedCat];

  return (
    <View style={styles.root}>
      {/* ── Top action bar ── */}
      <View style={styles.actionBar}>
        <View style={styles.actionBarLeft}>
          <TouchableOpacity style={styles.sidebarToggle} onPress={() => setSidebarCollapsed(p => !p)} activeOpacity={0.7}>
            <Maximize2 size={14} color={Colors.neonBlue} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.pageTitle} numberOfLines={1}>{t.uiSizes}</Text>
        </View>
        <View style={styles.actionBarRight}>
          <TouchableOpacity style={styles.resetAllBtn} onPress={resetAll} activeOpacity={0.8}>
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
        {/* Sidebar */}
        {!sidebarCollapsed && (
          <View style={[styles.sidebar, IS_MEDIUM ? styles.sidebarWide : styles.sidebarNarrow]}>
            <Text style={styles.sidebarTitle}>{t.components}</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CATEGORY_ORDER.map(cid => {
                const m = CATEGORY_META[cid];
                const isActive = cid === selectedCat;
                return (
                  <TouchableOpacity
                    key={cid}
                    style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                    onPress={() => {
                      setSelectedCat(cid);
                      if (!IS_MEDIUM) setSidebarCollapsed(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.catIconBox, { backgroundColor: m.color + '18', borderColor: m.color + '40' }]}>
                      {m.icon}
                    </View>
                    {IS_MEDIUM && (
                      <View style={styles.catMeta}>
                        <Text style={[styles.catLabel, isActive && { color: Colors.textPrimary }]} numberOfLines={1}>
                          {categories[cid]?.label ?? cid}
                        </Text>
                        <Text style={styles.catDesc} numberOfLines={1}>{m.description}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Controls panel */}
        <View style={styles.controlPanel}>
          {/* Header row */}
          <View style={styles.controlHeader}>
            <View style={[styles.catIconBox, { backgroundColor: meta.color + '18', borderColor: meta.color + '40' }]}>
              {meta.icon}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.controlTitle} numberOfLines={1}>{cat?.label ?? selectedCat}</Text>
              <Text style={styles.controlDesc} numberOfLines={1}>{meta.description}</Text>
            </View>
            <TouchableOpacity style={styles.resetCatBtn} onPress={() => resetCategory(selectedCat)} activeOpacity={0.8}>
              <RefreshCw size={11} color={Colors.textMuted} strokeWidth={2} />
              {IS_MEDIUM && <Text style={styles.resetCatText}>{t.resetSection}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveCatBtn, catSaveState === 'saving' && { opacity: 0.6 }]}
              onPress={handleSaveCat}
              disabled={catSaveState === 'saving'}
              activeOpacity={0.8}
            >
              {catSaveState === 'saving'
                ? <ActivityIndicator size="small" color={Colors.background} />
                : catSaveState === 'saved'
                ? <CheckCircle size={12} color={Colors.background} strokeWidth={2.5} />
                : catSaveState === 'error'
                ? <AlertCircle size={12} color={Colors.background} strokeWidth={2.5} />
                : <Save size={12} color={Colors.background} strokeWidth={2} />}
              {IS_MEDIUM && (
                <Text style={styles.saveCatText}>
                  {catSaveState === 'saving' ? t.saving : catSaveState === 'saved' ? t.savedBang : catSaveState === 'error' ? t.error : t.saveCategory}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Breakpoint row */}
          <View style={styles.bpRow}>
            <Text style={styles.bpLabel}>{t.breakpoint}</Text>
            <View style={styles.bpGroup}>
              {(['mobile', 'tablet', 'desktop'] as Breakpoint[]).map(bp => (
                <TouchableOpacity
                  key={bp}
                  style={[styles.bpChip, activeBp === bp && styles.bpChipActive]}
                  onPress={() => setActiveBp(bp)}
                  activeOpacity={0.7}
                >
                  {bp === 'mobile'  && <Smartphone size={11} color={activeBp === bp ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />}
                  {bp === 'tablet'  && <Tablet     size={11} color={activeBp === bp ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />}
                  {bp === 'desktop' && <Monitor    size={11} color={activeBp === bp ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />}
                  {IS_MEDIUM && (
                    <Text style={[styles.bpChipText, activeBp === bp && styles.bpChipTextActive]}>
                      {bp === 'mobile' ? t.mobile : bp === 'tablet' ? t.tablet : t.desktop}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.bpHint}>
              <Text style={styles.bpHintText}>
                {activeBp === 'mobile' ? '< 600px' : activeBp === 'tablet' ? '600–1023px' : '≥ 1024px'}
              </Text>
            </View>
          </View>

          {/* Fields */}
          <ScrollView style={styles.fieldScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldWrap}>
              {fieldGroups.map(group => (
                <View key={group.group} style={styles.group}>
                  <Text style={styles.groupLabel}>{group.group}</Text>
                  <View style={styles.groupInner}>
                    {group.fields.map(f => (
                      <SizeControlRow
                        key={f.key}
                        label={f.label}
                        glyph={f.glyph}
                        value={bpValues[f.key] ?? defaultBpValues[f.key] ?? 0}
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        defaultVal={defaultBpValues[f.key] ?? 0}
                        hint={f.hint}
                        onChange={v => handleChange(f.key, v)}
                      />
                    ))}
                  </View>
                </View>
              ))}
              <View style={{ height: 40 }} />
            </View>
          </ScrollView>
        </View>

        {/* Live Preview */}
        {IS_WIDE && (
          <SizePreview categoryId={selectedCat} activeBp={activeBp} bpValues={bpValues} />
        )}
      </View>
    </View>
  );
}

// ─── Live Preview ─────────────────────────────────────────────────────────────

function SizePreview({ categoryId, activeBp, bpValues }: { categoryId: CategoryId; activeBp: Breakpoint; bpValues: Record<string, number> }) {
  const meta = CATEGORY_META[categoryId];
  return (
    <View style={pvw.panel}>
      <Text style={pvw.panelTitle}>Live Preview</Text>
      <Text style={pvw.panelSub}>{activeBp.charAt(0).toUpperCase() + activeBp.slice(1)} · {CATEGORY_DEFAULTS[categoryId].label}</Text>

      <View style={pvw.phoneFrame}>
        <View style={pvw.phoneTop}>
          <View style={pvw.phoneCam} />
        </View>
        <ScrollView style={pvw.phoneScreen} showsVerticalScrollIndicator={false}>
          {categoryId === 'global' && (
            <View style={[pvw.mockBlock, { margin: Math.min(bpValues.horizontalPadding * 0.4, 12), borderRadius: (bpValues.cardRadius ?? 12) * 0.5, gap: Math.min(bpValues.sectionGap * 0.3, 12) }]}>
              <View style={[pvw.mockSection, { borderRadius: (bpValues.buttonRadius ?? 8) * 0.5, marginBottom: Math.min(bpValues.sectionGap * 0.3, 12) }]} />
              <View style={[pvw.mockSection, { height: 20, borderRadius: (bpValues.cardRadius ?? 12) * 0.5 }]} />
            </View>
          )}
          {categoryId === 'header' && (
            <View style={[pvw.headerMock, { height: Math.min(bpValues.headerHeight * 0.35, 36), paddingLeft: Math.min(bpValues.paddingLeft * 0.4, 10), paddingRight: Math.min(bpValues.paddingRight * 0.4, 10) }]}>
              <View style={[pvw.menuIcon, { width: bpValues.menuBtnSize * 0.5, height: bpValues.menuBtnSize * 0.5 }]} />
              <View style={[pvw.logoMock, { width: Math.min(bpValues.logoWidth * 0.35, 60), height: Math.min(bpValues.logoHeight * 0.5, 14) }]} />
              <View style={{ flexDirection: 'row', gap: 3 }}>
                <View style={[pvw.iconMock, { width: bpValues.iconSize * 0.5, height: bpValues.iconSize * 0.5 }]} />
                <View style={[pvw.iconMock, { width: bpValues.iconSize * 0.5, height: bpValues.iconSize * 0.5 }]} />
              </View>
            </View>
          )}
          {categoryId === 'search' && (
            <View style={{ padding: 8 }}>
              <View style={[pvw.searchMock, {
                height: Math.min(bpValues.barHeight * 0.5, 28),
                borderRadius: Math.min(bpValues.borderRadius * 0.6, 10),
                marginTop: Math.min(bpValues.marginTop * 0.4, 8),
                marginBottom: Math.min(bpValues.marginBottom * 0.4, 6),
              }]}>
                <View style={[pvw.searchIcon, { width: bpValues.iconSize * 0.5, height: bpValues.iconSize * 0.5 }]} />
                <View style={pvw.searchText} />
              </View>
            </View>
          )}
          {categoryId === 'filter' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ padding: 8 }}>
              <View style={{ flexDirection: 'row', gap: Math.min(bpValues.gap * 0.5, 6) }}>
                {['All', 'Canopy', 'Gear', 'Safety'].map(label => (
                  <View key={label} style={[pvw.filterChip, {
                    height: Math.min(bpValues.buttonHeight * 0.5, 20),
                    paddingHorizontal: Math.min(bpValues.paddingH * 0.4, 8),
                    borderRadius: Math.min(bpValues.borderRadius * 0.6, 8),
                  }]}>
                    <Text style={[pvw.filterChipText, { fontSize: Math.min(bpValues.fontSize * 0.5, 8) }]}>{label}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
          {categoryId === 'product_card' && (
            <View style={{ padding: 6 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Math.min((bpValues.cardGap ?? 8) * 0.4, 5) }}>
                {Array.from({ length: Math.min(bpValues.columns, 4) }).map((_, i) => (
                  <View key={i} style={[pvw.productCard, {
                    flex: 1,
                    padding: Math.min(bpValues.cardPadding * 0.4, 6),
                  }]}>
                    <View style={[pvw.cardImage, { height: Math.min(bpValues.imageHeight * 0.18, 44) }]} />
                    <View style={[pvw.cardTitle, { height: Math.min(bpValues.titleFontSize * 0.5, 7) }]} />
                    <View style={[pvw.cardPrice, { height: Math.min(bpValues.priceFontSize * 0.5, 9), width: '50%' }]} />
                  </View>
                ))}
              </View>
            </View>
          )}
          {categoryId === 'bottom_nav' && (
            <View style={[pvw.navMock, {
              height: Math.min(bpValues.navHeight * 0.4, 30),
              borderTopWidth: bpValues.borderTopWidth,
            }]}>
              {['Home', 'Cart', 'Account'].map(label => (
                <View key={label} style={[pvw.navItem, { gap: Math.min(bpValues.itemSpacing * 0.3, 4) }]}>
                  <View style={[pvw.navIcon, { width: bpValues.iconSize * 0.4, height: bpValues.iconSize * 0.4 }]} />
                  <Text style={[pvw.navLabel, { fontSize: Math.min(bpValues.labelFontSize * 0.55, 7) }]}>{label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Badge summary */}
          <View style={pvw.badgesWrap}>
            {Object.entries(bpValues).slice(0, 6).map(([k, v]) => (
              <View key={k} style={pvw.badge}>
                <Text style={pvw.badgeText}>{k.replace(/([A-Z])/g, ' $1').trim().slice(0, 10)}: {typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(1)) : v}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Size Control Row ─────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, isNaN(val) ? min : val));
}

function SizeControlRow({
  label, glyph, value, min, max, step, defaultVal, hint, onChange,
}: {
  label: string; glyph: string; value: number;
  min: number; max: number; step: number;
  defaultVal: number; hint?: string; onChange: (v: number) => void;
}) {
  const [inputVal, setInputVal] = useState(String(value));
  const isDefault = value === defaultVal;

  React.useEffect(() => { setInputVal(String(value)); }, [value]);

  const commit = useCallback((raw: string) => {
    const n = parseFloat(raw);
    const clamped = clamp(isNaN(n) ? defaultVal : n, min, max);
    setInputVal(String(clamped));
    onChange(clamped);
  }, [min, max, defaultVal, onChange]);

  const step_ = (dir: 1 | -1) => {
    const next = clamp(parseFloat((value + dir * step).toFixed(4)), min, max);
    onChange(next);
    setInputVal(String(next));
  };

  return (
    <View style={ctrl.row}>
      <View style={ctrl.rowLabelRow}>
        <Text style={ctrl.rowGlyph}>{glyph}</Text>
        <Text style={ctrl.rowLabelText}>{label}</Text>
        {!isDefault && (
          <TouchableOpacity
            style={ctrl.resetPill}
            onPress={() => { onChange(defaultVal); setInputVal(String(defaultVal)); }}
            activeOpacity={0.7}
          >
            <Text style={ctrl.resetPillText}>↺ reset</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={ctrl.rowValueRow}>
        <Text style={[ctrl.valueDisplay, !isDefault && { color: Colors.neonBlue }]}>
          {Number.isInteger(value) ? value : value.toFixed(1)}{hint ? ' ' + hint : ''}
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
      {Platform.OS === 'web' && (
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
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  stateWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: 12, paddingHorizontal: Spacing.xl,
  },
  stateText: {
    color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
    backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 20, paddingVertical: 10,
  },
  retryBtnText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700' },

  root: { flex: 1, backgroundColor: Colors.background },

  actionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundCard, gap: 8,
  },
  actionBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  actionBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sidebarToggle: {
    width: 28, height: 28, borderRadius: Radius.sm,
    backgroundColor: Colors.neonBlueGlow, borderWidth: 1, borderColor: Colors.neonBlueBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  pageTitle: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '800', flex: 1 },
  resetAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 9, paddingVertical: 6,
  },
  resetAllText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  saveAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.neonBlue, borderRadius: Radius.sm,
    paddingHorizontal: 12, paddingVertical: 6, minWidth: 80, justifyContent: 'center',
  },
  saveAllText: { color: Colors.background, fontSize: FontSize.xs, fontWeight: '800' },

  body: { flex: 1, flexDirection: 'row' },

  sidebar: {
    borderRightWidth: 1, borderRightColor: Colors.border,
    backgroundColor: Colors.backgroundCard, padding: Spacing.xs,
  },
  sidebarWide: { width: 210 },
  sidebarNarrow: { width: 52 },
  sidebarTitle: {
    color: Colors.textMuted, fontSize: 9, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 4, marginBottom: 6, marginTop: 4,
  },
  sidebarItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 7, paddingVertical: 8, borderRadius: Radius.sm,
    marginBottom: 2, borderWidth: 1, borderColor: 'transparent',
  },
  sidebarItemActive: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlueBorder },
  catIconBox: {
    width: 28, height: 28, borderRadius: Radius.sm,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, flexShrink: 0,
  },
  catMeta: { flex: 1, minWidth: 0 },
  catLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700' },
  catDesc: { color: Colors.textMuted, fontSize: 9, marginTop: 1 },

  controlPanel: { flex: 1, backgroundColor: Colors.background, minWidth: 0 },
  controlHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.sm, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
  },
  controlTitle: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '800' },
  controlDesc: { color: Colors.textMuted, fontSize: 9, marginTop: 1 },
  resetCatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 6,
  },
  resetCatText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  saveCatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.neonBlue, borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 6, minWidth: 36, justifyContent: 'center',
  },
  saveCatText: { color: Colors.background, fontSize: FontSize.xs, fontWeight: '800' },

  bpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: Spacing.sm, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.backgroundSecondary,
  },
  bpLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  bpGroup: { flexDirection: 'row', gap: 4 },
  bpChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 5,
  },
  bpChipActive: { backgroundColor: Colors.neonBlueGlow, borderColor: Colors.neonBlue },
  bpChipText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  bpChipTextActive: { color: Colors.neonBlue },
  bpHint: { marginLeft: 'auto' as any },
  bpHintText: { color: Colors.textMuted, fontSize: 9 },

  fieldScroll: { flex: 1 },
  fieldWrap: { padding: Spacing.sm },
  group: { marginBottom: Spacing.md },
  groupLabel: {
    color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, paddingHorizontal: 2,
  },
  groupInner: { gap: 4 },
});

const ctrl = StyleSheet.create({
  row: {
    backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.sm,
    padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  rowLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  rowGlyph: { color: Colors.textMuted, fontSize: 11, width: 14, textAlign: 'center', fontWeight: '700' },
  rowLabelText: {
    color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '700',
    flex: 1, textTransform: 'uppercase', letterSpacing: 0.3,
  },
  resetPill: {
    backgroundColor: Colors.neonBlueGlow, borderRadius: Radius.full,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: Colors.neonBlueBorder,
  },
  resetPillText: { color: Colors.neonBlue, fontSize: 8, fontWeight: '800' },
  rowValueRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  valueDisplay: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  stepBtn: {
    width: 22, height: 22, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.backgroundCard, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  stepText: {
    color: Colors.textPrimary, fontSize: 14, fontWeight: '700',
    lineHeight: 16, includeFontPadding: false,
  },
  numInput: {
    width: 44, height: 22, backgroundColor: Colors.backgroundCard,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: '700', textAlign: 'center',
  },
  sliderWrap: { marginTop: 2 },
  sliderMarks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 1 },
  sliderMark: { color: Colors.textMuted, fontSize: 8 },
});

const pvw = StyleSheet.create({
  panel: {
    width: 220, borderLeftWidth: 1, borderLeftColor: Colors.border,
    backgroundColor: Colors.backgroundCard, padding: Spacing.sm,
  },
  panelTitle: {
    color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  panelSub: { color: Colors.textMuted, fontSize: 9, marginBottom: Spacing.sm },
  phoneFrame: {
    borderWidth: 2, borderColor: Colors.border, borderRadius: 16,
    overflow: 'hidden', backgroundColor: Colors.background, flex: 1, maxHeight: 460,
  },
  phoneTop: {
    height: 20, backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  phoneCam: { width: 20, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  phoneScreen: { flex: 1 },

  mockBlock: { backgroundColor: Colors.backgroundCard, margin: 6, padding: 6 },
  mockSection: {
    height: 30, backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 4,
  },

  headerMock: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.backgroundCard, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  menuIcon: { backgroundColor: Colors.textMuted, borderRadius: 2 },
  logoMock: { backgroundColor: Colors.neonBlue + '40', borderRadius: 2 },
  iconMock: { backgroundColor: Colors.textMuted + '60', borderRadius: 999 },

  searchMock: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border,
    marginHorizontal: 4, paddingHorizontal: 6,
  },
  searchIcon: { backgroundColor: Colors.textMuted, borderRadius: 999 },
  searchText: { flex: 1, height: 4, backgroundColor: Colors.border, borderRadius: 2 },

  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipText: { color: Colors.textMuted, fontWeight: '700' },

  productCard: {
    backgroundColor: Colors.backgroundCard, borderRadius: 6,
    borderWidth: 1, borderColor: Colors.border, minWidth: 30,
  },
  cardImage: { backgroundColor: Colors.backgroundSecondary, borderRadius: 4, marginBottom: 4 },
  cardTitle: { backgroundColor: Colors.border, borderRadius: 2, marginBottom: 3, width: '80%' },
  cardPrice: { backgroundColor: Colors.neonBlue + '40', borderRadius: 2 },

  navMock: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: Colors.backgroundCard, borderTopColor: Colors.border,
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navIcon: { backgroundColor: Colors.textMuted, borderRadius: 4 },
  navLabel: { color: Colors.textMuted, fontWeight: '700', marginTop: 1 },

  badgesWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 3, padding: 6,
  },
  badge: {
    backgroundColor: Colors.backgroundSecondary, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2,
  },
  badgeText: { color: Colors.textMuted, fontSize: 7, fontWeight: '700' },
});
