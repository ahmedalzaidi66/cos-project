import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Image,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Save, RotateCcw, CircleCheck as CheckCircle, Eye, EyeOff, ChevronUp, ChevronDown, GripVertical, Trash2, Copy, Plus, Smartphone, Monitor, Sparkles, Star, MessageSquare, Megaphone, PanelBottom as AlignBottom, LayoutGrid as Layout, Image as ImageIcon, User, Undo2, Redo2, X, CircleAlert as AlertCircle, Rows3 } from 'lucide-react-native';
import { useAdmin } from '@/context/AdminContext';
import { useLanguage } from '@/context/LanguageContext';
import AdminWebDashboard from '@/components/admin/AdminWebDashboard';
import AdminMobileDashboard from '@/components/admin/AdminMobileDashboard';
import AdminGuard from '@/components/admin/AdminGuard';
import MobileUnsupported from '@/components/admin/MobileUnsupported';
import { useAdminLayout } from '@/hooks/useAdminLayout';
import BlockSettingsPanel from '@/components/admin/BlockSettingsPanel';
import {
  PageBuilderProvider,
  usePageBuilder,
  PageBlock,
  BlockType,
} from '@/context/PageBuilderContext';
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_WIDE = SCREEN_WIDTH > 900;

const BLOCK_META: Record<BlockType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  header: { label: 'Header', icon: <Layout size={16} color={Colors.neonBlue} strokeWidth={2} />, color: Colors.neonBlue, description: 'App bar with logo & navigation' },
  hero: { label: 'Hero Banner', icon: <ImageIcon size={16} color={Colors.warning} strokeWidth={2} />, color: Colors.warning, description: 'Full-width image with title & CTA' },
  featured: { label: 'Featured', icon: <Star size={16} color={Colors.gold} strokeWidth={2} />, color: Colors.gold, description: 'Grid of featured products' },
  canopy: { label: 'Beauty Filter', icon: <Sparkles size={16} color={Colors.success} strokeWidth={2} />, color: Colors.success, description: 'Virtual try-on tool' },
  testimonials: { label: 'Testimonials', icon: <MessageSquare size={16} color='#B39DDB' strokeWidth={2} />, color: '#B39DDB', description: 'Customer reviews & ratings' },
  banner: { label: 'Promo Banner', icon: <Megaphone size={16} color={Colors.error} strokeWidth={2} />, color: Colors.error, description: 'Promotional strip with link' },
  footer: { label: 'Footer', icon: <AlignBottom size={16} color={Colors.textMuted} strokeWidth={2} />, color: Colors.textMuted, description: 'Footer with links & copyright' },
  section_row: { label: 'Product Section', icon: <Rows3 size={16} color='#F472B6' strokeWidth={2} />, color: '#F472B6', description: 'Homepage product row section' },
};

const ADD_BLOCK_OPTIONS: BlockType[] = ['hero', 'featured', 'canopy', 'testimonials', 'banner', 'footer'];

function SaveToast({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  const { t } = useLanguage();
  if (status === 'idle') return null;
  const isError = status === 'error';
  const isSaving = status === 'saving';
  return (
    <View style={[toast.wrap, isError ? toast.wrapError : isSaving ? toast.wrapSaving : toast.wrapSaved]}>
      {isSaving && <ActivityIndicator size="small" color={Colors.neonBlue} />}
      {status === 'saved' && <CheckCircle size={15} color={Colors.success} strokeWidth={2.5} />}
      {isError && <AlertCircle size={15} color={Colors.error} strokeWidth={2.5} />}
      <Text style={[toast.text, isError && { color: Colors.error }, status === 'saved' && { color: Colors.success }]}>
        {isSaving ? t.savingLayout : status === 'saved' ? t.layoutSaved : t.saveFailed}
      </Text>
    </View>
  );
}

const toast = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, position: 'absolute', bottom: 20, alignSelf: 'center', zIndex: 999 },
  wrapSaving: { backgroundColor: Colors.backgroundCard, borderColor: Colors.neonBlueBorder },
  wrapSaved: { backgroundColor: 'rgba(0,230,118,0.1)', borderColor: 'rgba(0,230,118,0.35)' },
  wrapError: { backgroundColor: Colors.errorDim, borderColor: Colors.error },
  text: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
});

type DraggableBlockProps = {
  block: PageBlock;
  idx: number;
  total: number;
  isSelected: boolean;
  dragIndex: number | null;
  dropIndex: number | null;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onDragStart: (idx: number) => void;
  onDragEnter: (idx: number) => void;
  onDragEnd: () => void;
};

function DraggableBlock({
  block, idx, total, isSelected, dragIndex, dropIndex,
  onSelect, onMoveUp, onMoveDown, onToggle, onDuplicate, onRemove,
  onDragStart, onDragEnter, onDragEnd,
}: DraggableBlockProps) {
  const { t } = useLanguage();
  const blockLabels: Record<string, string> = {
    header: t.blockLabelHeader, hero: t.blockLabelHero, featured: t.blockLabelFeatured,
    canopy: t.blockLabelCanopy, testimonials: t.blockLabelTestimonials, banner: t.blockLabelBanner, footer: t.blockLabelFooter,
  };
  const blockDescs: Record<string, string> = {
    header: t.blockDescHeader, hero: t.blockDescHero, featured: t.blockDescFeatured,
    canopy: t.blockDescCanopy, testimonials: t.blockDescTestimonials, banner: t.blockDescBanner, footer: t.blockDescFooter,
  };
  const meta = BLOCK_META[block.type] ?? { color: '#888888', icon: null, label: block.type, description: '' };
  const isSectionRow = block.type === 'section_row';
  const isFirst = idx === 0;
  const isLast = idx === total - 1;
  const isDragging = dragIndex === idx;
  const isDropTarget = dropIndex === idx && dragIndex !== null && dragIndex !== idx;

  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const animatePress = useCallback(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }),
    ]).start();
  }, [scale]);

  const animateRelease = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  }, [scale]);

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: isDragging ? 0.45 : 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
    Animated.spring(scale, {
      toValue: isDragging ? 0.96 : 1,
      useNativeDriver: true,
      speed: 40,
    }).start();
  }, [isDragging]);

  const moveUp = (e: any) => { e.stopPropagation?.(); onMoveUp(); };
  const moveDown = (e: any) => { e.stopPropagation?.(); onMoveDown(); };
  const toggle = (e: any) => { e.stopPropagation?.(); onToggle(); };
  const duplicate = (e: any) => { e.stopPropagation?.(); onDuplicate(); };
  const remove = (e: any) => { e.stopPropagation?.(); onRemove(); };

  return (
    <View>
      {isDropTarget && <DropZone />}
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <TouchableOpacity
          style={[
            styles.blockItem,
            isSelected && styles.blockItemActive,
            !block.visible && styles.blockItemHidden,
            isDragging && styles.blockItemDragging,
          ]}
          onPress={onSelect}
          onPressIn={animatePress}
          onPressOut={animateRelease}
          activeOpacity={1}
        >
          {isSelected && <View style={[styles.blockActiveBar, { backgroundColor: meta.color }]} />}

          <View
            style={styles.blockGrip}
            onStartShouldSetResponder={() => true}
            onResponderGrant={() => onDragStart(idx)}
            onResponderRelease={() => onDragEnd()}
          >
            <GripVertical size={16} color={Colors.textMuted} strokeWidth={1.5} />
          </View>

          <View style={[styles.blockIcon, { backgroundColor: `${meta.color}22` }]}>
            {meta.icon}
          </View>

          <View style={styles.blockInfo}>
            <Text style={[styles.blockLabel, !block.visible && styles.blockLabelHidden]}>
              {isSectionRow
                ? (block.content.title_en || block.content.title_ar || 'Product Section')
                : (blockLabels[block.type] ?? meta.label)}
            </Text>
            <Text style={styles.blockDesc} numberOfLines={1}>
              {isSectionRow
                ? (block.content.title_ar ? `${block.content.title_ar} · ` : '') + (block.content.is_active ? 'Active' : 'Hidden')
                : (blockDescs[block.type] ?? meta.description)}
            </Text>
          </View>

          <View style={styles.blockActions}>
            <TouchableOpacity style={styles.blockActionBtn} onPress={moveUp} disabled={isFirst} activeOpacity={0.7}>
              <ChevronUp size={14} color={isFirst ? Colors.border : Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.blockActionBtn} onPress={moveDown} disabled={isLast} activeOpacity={0.7}>
              <ChevronDown size={14} color={isLast ? Colors.border : Colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.blockActionBtn} onPress={toggle} activeOpacity={0.7}>
              {block.visible
                ? <Eye size={14} color={Colors.neonBlue} strokeWidth={2} />
                : <EyeOff size={14} color={Colors.textMuted} strokeWidth={2} />}
            </TouchableOpacity>
            {!isSectionRow && (
              <TouchableOpacity style={styles.blockActionBtn} onPress={duplicate} activeOpacity={0.7}>
                <Copy size={14} color={Colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            )}
            <View style={styles.blockActionDivider} />
            {isSectionRow ? (
              <View style={[styles.blockActionBtn, styles.sectionRowLockBtn]}>
                <Text style={styles.sectionRowLockText}>↕</Text>
              </View>
            ) : (
              <TouchableOpacity style={[styles.blockActionBtn, styles.blockActionDelete]} onPress={remove} activeOpacity={0.7}>
                <Trash2 size={14} color={Colors.error} strokeWidth={2} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function DropZone() {
  const { t } = useLanguage();
  const anim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0.5, duration: 600, useNativeDriver: false }),
      ])
    ).start();
  }, []);
  const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.neonBlueBorder, Colors.neonBlue] });
  const bgColor = anim.interpolate({ inputRange: [0, 1], outputRange: [Colors.neonBlueGlow, 'rgba(255,77,141,0.18)'] });
  return (
    <Animated.View style={[styles.dropZone, { borderColor, backgroundColor: bgColor }]}>
      <Text style={styles.dropZoneText}>{t.dropHere}</Text>
    </Animated.View>
  );
}

function BlockList() {
  const { t } = useLanguage();
  const {
    blocks, selectedBlockId, setSelectedBlockId,
    moveBlock, toggleBlockVisibility, removeBlock, duplicateBlock,
  } = usePageBuilder();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const sorted = [...blocks].sort((a, b) => a.order_index - b.order_index);

  const handleDragStart = useCallback((idx: number) => {
    setDragIndex(idx);
  }, []);

  const handleDragEnter = useCallback((idx: number) => {
    if (dragIndex === null || idx === dragIndex) return;
    setDropIndex(idx);
  }, [dragIndex]);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const diff = dropIndex - dragIndex;
      const steps = Math.abs(diff);
      const dir = diff > 0 ? 'down' : 'up';
      const id = sorted[dragIndex].id;
      for (let i = 0; i < steps; i++) moveBlock(id, dir);
    }
    setDragIndex(null);
    setDropIndex(null);
  }, [dragIndex, dropIndex, sorted, moveBlock]);

  return (
    <View style={styles.blockList}>
      <View style={styles.blockListHeader}>
        <Text style={styles.blockListTitle}>{t.sections}</Text>
        <View style={styles.blockListMeta}>
          <Text style={styles.blockListCount}>{sorted.length} {t.blocks}</Text>
          <Text style={styles.blockListHint}>· {t.dragToReorder}</Text>
        </View>
      </View>
      {sorted.map((block, idx) => (
        <DraggableBlock
          key={block.id}
          block={block}
          idx={idx}
          total={sorted.length}
          isSelected={block.id === selectedBlockId}
          dragIndex={dragIndex}
          dropIndex={dropIndex}
          onSelect={() => setSelectedBlockId(block.id === selectedBlockId ? null : block.id)}
          onMoveUp={() => moveBlock(block.id, 'up')}
          onMoveDown={() => moveBlock(block.id, 'down')}
          onToggle={() => toggleBlockVisibility(block.id)}
          onDuplicate={() => duplicateBlock(block.id)}
          onRemove={() => removeBlock(block.id)}
          onDragStart={handleDragStart}
          onDragEnter={handleDragEnter}
          onDragEnd={handleDragEnd}
        />
      ))}
      {dropIndex === sorted.length && dragIndex !== null && <DropZone />}
    </View>
  );
}

function PreviewBlock({ block }: { block: PageBlock }) {
  const c: Record<string, any> = block.content ?? {};
  const [imgErr, setImgErr] = useState(false);

  switch (block.type) {
    case 'header':
      return (
        <View style={pb.header}>
          <View style={pb.menuLines}>
            {[0,1,2].map(i => <View key={i} style={[pb.menuLine, i === 1 && { width: '60%' }]} />)}
          </View>
          <Text style={pb.headerLogo}>
            <Text style={{ color: Colors.textPrimary }}>LAZURDE</Text>
            <Text style={{ color: Colors.neonBlue }}> MAKEUP</Text>
          </Text>
          <View style={pb.headerIcons}>
            {c.show_account !== false && <User size={11} color={Colors.textMuted} strokeWidth={2} />}
            {c.show_cart !== false && (
              <View style={pb.cartIconWrap}>
                <View style={pb.cartDot} />
              </View>
            )}
          </View>
        </View>
      );
    case 'hero':
      return (
        <View style={pb.heroWrap}>
          {c.image_url && !imgErr ? (
            <Image source={{ uri: c.image_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" onError={() => setImgErr(true)} />
          ) : (
            <View style={pb.heroImgFallback}>
              <ImageIcon size={22} color={Colors.textMuted} strokeWidth={1.5} />
              <Text style={{ color: Colors.textMuted, fontSize: 8, marginTop: 4 }}>No image set</Text>
            </View>
          )}
          <View style={[pb.heroOverlay, { backgroundColor: c.overlay_color || 'rgba(5,10,20,0.55)' }]} />
          <View style={pb.heroContent}>
            {c.badge_text ? (
              <View style={pb.heroBadgeRow}>
                <Sparkles size={7} color={Colors.neonBlue} strokeWidth={2} />
                <Text style={pb.heroBadge}>{c.badge_text}</Text>
              </View>
            ) : null}
            <Text style={pb.heroTitle} numberOfLines={2}>{c.title || 'Hero Title'}</Text>
            {c.subtitle ? <Text style={pb.heroSub} numberOfLines={2}>{c.subtitle}</Text> : null}
            {c.cta_primary ? (
              <View style={pb.heroBtn}>
                <Text style={pb.heroBtnText}>{c.cta_primary}</Text>
              </View>
            ) : null}
          </View>
        </View>
      );
    case 'featured':
      return (
        <View style={pb.section}>
          <Text style={pb.sectionTitle}>{c.title || 'Featured Products'}</Text>
          {c.subtitle ? <Text style={pb.sectionSub}>{c.subtitle}</Text> : null}
          <View style={pb.productGrid}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={pb.productCard}>
                <View style={pb.productCardImg} />
                <View style={pb.productCardLine} />
                <View style={[pb.productCardLine, { width: '60%' }]} />
              </View>
            ))}
          </View>
        </View>
      );
    case 'canopy':
      return (
        <View style={pb.canopySection}>
          <Sparkles size={20} color={Colors.neonBlue} strokeWidth={1.5} />
          <Text style={pb.sectionTitle}>{c.title || 'Beauty Filter'}</Text>
          {c.subtitle ? <Text style={[pb.sectionSub, { textAlign: 'center' }]} numberOfLines={2}>{c.subtitle}</Text> : null}
          {c.cta_text ? (
            <View style={pb.canopyBtn}>
              <Text style={pb.heroBtnText}>{c.cta_text}</Text>
            </View>
          ) : null}
        </View>
      );
    case 'testimonials':
      return (
        <View style={pb.section}>
          <Text style={pb.sectionTitle}>{c.title || 'Testimonials'}</Text>
          {c.subtitle ? <Text style={pb.sectionSub}>{c.subtitle}</Text> : null}
          <View style={pb.testimRow}>
            {[1, 2].map(i => (
              <View key={i} style={pb.testimCard}>
                <Text style={{ color: Colors.gold, fontSize: 9 }}>★★★★★</Text>
                <View style={[pb.productCardLine, { marginTop: 4 }]} />
                <View style={[pb.productCardLine, { width: '70%', marginTop: 3 }]} />
                <Text style={pb.testimAuthor}>— Verified Buyer</Text>
              </View>
            ))}
          </View>
        </View>
      );
    case 'banner':
      return (
        <View style={[pb.banner, { backgroundColor: c.bg_color || '#FF4D8D' }]}>
          <Megaphone size={10} color={c.text_color || '#0A0507'} strokeWidth={2} />
          <Text style={[pb.bannerText, { color: c.text_color || '#0A0507' }]} numberOfLines={1}>
            {c.text || 'Promotional banner text'}
          </Text>
          {c.link_text ? (
            <Text style={[pb.bannerLink, { color: c.text_color || '#0A0507' }]}>{c.link_text} →</Text>
          ) : null}
        </View>
      );
    case 'footer':
      return (
        <View style={pb.footer}>
          <Text style={pb.footerLogo}>GLOW</Text>
          {c.tagline ? <Text style={pb.footerTagline} numberOfLines={1}>{c.tagline}</Text> : null}
          <View style={pb.footerDivider} />
          <View style={pb.footerCols}>
            <View style={pb.footerCol}>
              <Text style={pb.footerColTitle}>{c.col1_title || 'Shop'}</Text>
              {['Lipstick', 'Skincare', 'Tools'].map(l => (
                <Text key={l} style={pb.footerColLink}>{l}</Text>
              ))}
            </View>
            <View style={pb.footerCol}>
              <Text style={pb.footerColTitle}>{c.col2_title || 'Company'}</Text>
              {['About', 'Blog', 'Jobs'].map(l => (
                <Text key={l} style={pb.footerColLink}>{l}</Text>
              ))}
            </View>
            <View style={pb.footerCol}>
              <Text style={pb.footerColTitle}>{c.col3_title || 'Support'}</Text>
              {['FAQ', 'Returns', 'Contact'].map(l => (
                <Text key={l} style={pb.footerColLink}>{l}</Text>
              ))}
            </View>
          </View>
          {c.copyright ? <Text style={pb.footerCopyright}>{c.copyright}</Text> : null}
        </View>
      );
    case 'section_row':
      return (
        <View style={pb.sectionRowWrap}>
          <Rows3 size={11} color='#F472B6' strokeWidth={2} />
          <Text style={pb.sectionRowTitle} numberOfLines={1}>
            {c.title_en || c.title_ar || 'Product Section'}
          </Text>
          <View style={[pb.sectionRowBadge, !c.is_active && pb.sectionRowBadgeOff]}>
            <Text style={[pb.sectionRowBadgeText, !c.is_active && pb.sectionRowBadgeTextOff]}>
              {c.is_active ? 'Active' : 'Hidden'}
            </Text>
          </View>
        </View>
      );
    default:
      return null;
  }
}

function LivePreview({ selectedBlockId, onSelectBlock }: { selectedBlockId: string | null; onSelectBlock: (id: string) => void }) {
  const { t } = useLanguage();
  const { blocks } = usePageBuilder();
  const sorted = [...blocks].sort((a, b) => a.order_index - b.order_index).filter(b => b.visible);

  return (
    <View style={styles.phoneFrame}>
      <View style={styles.phoneSpeaker} />
      <View style={styles.phoneCamera} />
      <ScrollView style={styles.phoneScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        {sorted.map((block) => {
          const isActive = block.id === selectedBlockId;
          return (
            <TouchableOpacity
              key={block.id}
              activeOpacity={0.92}
              onPress={() => onSelectBlock(block.id)}
              style={[styles.previewBlock, isActive && styles.previewBlockActive]}
            >
              <PreviewBlock block={block} />
              {isActive && (
                <View style={styles.previewBlockBadge}>
                  <Text style={styles.previewBlockBadgeText}>{BLOCK_META[block.type].label}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        {sorted.length === 0 && (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: Colors.textMuted, fontSize: 9 }}>{t.noVisibleBlocks}</Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.phoneHomeBar} />
    </View>
  );
}

function AddBlockPanel({ onAdd, onClose }: { onAdd: (type: BlockType) => void; onClose: () => void }) {
  const { t } = useLanguage();
  const blockLabels: Record<string, string> = {
    header: t.blockLabelHeader, hero: t.blockLabelHero, featured: t.blockLabelFeatured,
    canopy: t.blockLabelCanopy, testimonials: t.blockLabelTestimonials, banner: t.blockLabelBanner, footer: t.blockLabelFooter,
  };
  const blockDescs: Record<string, string> = {
    header: t.blockDescHeader, hero: t.blockDescHero, featured: t.blockDescFeatured,
    canopy: t.blockDescCanopy, testimonials: t.blockDescTestimonials, banner: t.blockDescBanner, footer: t.blockDescFooter,
  };
  return (
    <View style={styles.addPanel}>
      <View style={styles.addPanelHeader}>
        <Text style={styles.addPanelTitle}>{t.addBlock}</Text>
        <TouchableOpacity onPress={onClose} style={styles.addPanelClose} activeOpacity={0.7}>
          <X size={16} color={Colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      <View style={styles.addPanelGrid}>
        {ADD_BLOCK_OPTIONS.map(type => {
          const meta = BLOCK_META[type];
          return (
            <TouchableOpacity
              key={type}
              style={styles.addPanelItem}
              onPress={() => { onAdd(type); onClose(); }}
              activeOpacity={0.7}
            >
              <View style={[styles.addPanelIcon, { backgroundColor: `${meta.color}1A` }]}>
                {meta.icon}
              </View>
              <Text style={styles.addPanelLabel}>{blockLabels[type] ?? meta.label}</Text>
              <Text style={styles.addPanelDesc}>{blockDescs[type] ?? meta.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function BuilderContent() {
  const { t } = useLanguage();
  const { isAdminAuthenticated } = useAdmin();
  const router = useRouter();
  const {
    layout, blocks, loading, loadError, saving, saveStatus, canUndo, canRedo,
    selectedBlockId, setSelectedBlockId,
    addBlock, saveLayout, restoreDefaults, createDefaultLayout, undo, redo, refresh,
  } = usePageBuilder();
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [previewMode, setPreviewMode] = useState<'editor' | 'preview'>('editor');
  const [creating, setCreating] = useState(false);

  React.useEffect(() => {
    if (!isAdminAuthenticated) router.replace('/admin/login');
  }, [isAdminAuthenticated]);

  const sorted = [...blocks].sort((a, b) => a.order_index - b.order_index);
  const selectedBlock = sorted.find(b => b.id === selectedBlockId) ?? null;

  const handleSelectFromPreview = useCallback((id: string) => {
    setSelectedBlockId(id === selectedBlockId ? null : id);
    if (!IS_WIDE) setPreviewMode('editor');
  }, [selectedBlockId, setSelectedBlockId]);

  const handleCreateDefault = async () => {
    setCreating(true);
    await createDefaultLayout();
    setCreating(false);
  };

  if (loading) {
    return (
      <AdminWebDashboard title={t.pageBuilder}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={Colors.neonBlue} size="large" />
          <Text style={styles.loadingText}>{t.loadingPageLayout}</Text>
        </View>
      </AdminWebDashboard>
    );
  }

  if (loadError) {
    return (
      <AdminWebDashboard title={t.pageBuilder}>
        <View style={styles.loadingWrap}>
          <AlertCircle size={36} color={Colors.error} strokeWidth={1.5} />
          <Text style={[styles.loadingText, { color: Colors.error, fontWeight: '700' }]}>{t.errorLoadingPageLayout}</Text>
          <Text style={[styles.loadingText, { fontSize: FontSize.xs }]}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>{t.retry}</Text>
          </TouchableOpacity>
        </View>
      </AdminWebDashboard>
    );
  }

  if (!layout) {
    return (
      <AdminWebDashboard title={t.pageBuilder}>
        <View style={styles.loadingWrap}>
          <Layout size={36} color={Colors.textMuted} strokeWidth={1.5} />
          <Text style={[styles.loadingText, { fontWeight: '700', color: Colors.textPrimary }]}>{t.noLayoutFound}</Text>
          <Text style={[styles.loadingText, { fontSize: FontSize.xs, textAlign: 'center' }]}>
            {t.noLayoutDesc}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: Colors.neonBlue }]}
            onPress={handleCreateDefault}
            disabled={creating}
            activeOpacity={0.8}
          >
            {creating
              ? <ActivityIndicator size="small" color={Colors.background} />
              : <Text style={[styles.retryBtnText, { color: Colors.background }]}>{t.createDefaultLayout}</Text>
            }
          </TouchableOpacity>
        </View>
      </AdminWebDashboard>
    );
  }

  const toolbar = (
    <View style={styles.toolbar}>
      <View style={styles.toolbarLeft}>
        <Layout size={15} color={Colors.neonBlue} strokeWidth={2} />
        <Text style={styles.toolbarTitle}>{t.pageBuilder}</Text>
        <View style={styles.pageTag}><Text style={styles.pageTagText}>{t.homepage}</Text></View>
      </View>
      <View style={styles.toolbarRight}>
        <View style={styles.undoRedoGroup}>
          <TouchableOpacity
            style={[styles.iconToolBtn, !canUndo && styles.iconToolBtnDisabled]}
            onPress={undo}
            disabled={!canUndo}
            activeOpacity={0.7}
          >
            <Undo2 size={14} color={canUndo ? Colors.textSecondary : Colors.border} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconToolBtn, !canRedo && styles.iconToolBtnDisabled]}
            onPress={redo}
            disabled={!canRedo}
            activeOpacity={0.7}
          >
            <Redo2 size={14} color={canRedo ? Colors.textSecondary : Colors.border} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {!IS_WIDE && (
          <View style={styles.previewToggle}>
            <TouchableOpacity
              style={[styles.previewToggleBtn, previewMode === 'editor' && styles.previewToggleBtnActive]}
              onPress={() => setPreviewMode('editor')}
              activeOpacity={0.7}
            >
              <Monitor size={13} color={previewMode === 'editor' ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
              <Text style={[styles.previewToggleText, previewMode === 'editor' && styles.previewToggleTextActive]}>{t.edit}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.previewToggleBtn, previewMode === 'preview' && styles.previewToggleBtnActive]}
              onPress={() => setPreviewMode('preview')}
              activeOpacity={0.7}
            >
              <Smartphone size={13} color={previewMode === 'preview' ? Colors.neonBlue : Colors.textMuted} strokeWidth={2} />
              <Text style={[styles.previewToggleText, previewMode === 'preview' && styles.previewToggleTextActive]}>{t.preview}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddPanel(v => !v)}
          activeOpacity={0.8}
        >
          <Plus size={14} color={Colors.neonBlue} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>{t.add}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetBtn} onPress={restoreDefaults} activeOpacity={0.8}>
          <RotateCcw size={13} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.resetBtnText}>{t.reset}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.75 }]}
          onPress={saveLayout}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={Colors.background} size="small" />
            : <Save size={14} color={Colors.background} strokeWidth={2.5} />}
          <Text style={styles.saveBtnText}>{saving ? t.saving : t.save}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const editorPanel = (
    <ScrollView style={styles.editorCol} showsVerticalScrollIndicator={false}>
      {showAddPanel && (
        <AddBlockPanel onAdd={addBlock} onClose={() => setShowAddPanel(false)} />
      )}
      <BlockList />
      {selectedBlock && (
        <View style={[styles.settingsPanelMobile, IS_WIDE && { display: 'none' }]}>
          <BlockSettingsPanel block={selectedBlock} onClose={() => setSelectedBlockId(null)} />
        </View>
      )}
      <View style={{ height: 80 }} />
    </ScrollView>
  );

  const previewPanel = (
    <View style={styles.previewColumn}>
      <View style={styles.previewHeader}>
        <Smartphone size={13} color={Colors.neonBlue} strokeWidth={2} />
        <Text style={styles.previewHeaderText}>{t.livePreview}</Text>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>{t.live}</Text>
        </View>
      </View>
      <LivePreview selectedBlockId={selectedBlockId} onSelectBlock={handleSelectFromPreview} />
    </View>
  );

  return (
    <AdminWebDashboard title={t.pageBuilder}>
      <View style={styles.container}>
        {toolbar}
        {IS_WIDE ? (
          <View style={styles.wideLayout}>
            {editorPanel}
            {selectedBlock ? (
              <View style={styles.settingsPanelWide}>
                <BlockSettingsPanel block={selectedBlock} onClose={() => setSelectedBlockId(null)} />
              </View>
            ) : (
              previewPanel
            )}
          </View>
        ) : (
          previewMode === 'editor' ? editorPanel : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {previewPanel}
            </ScrollView>
          )
        )}
        <SaveToast status={saveStatus} />
      </View>
    </AdminWebDashboard>
  );
}

const pb = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.background, paddingHorizontal: 10, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  menuLines: { gap: 3, justifyContent: 'center' },
  menuLine: { width: 14, height: 2, backgroundColor: Colors.textMuted, borderRadius: 1 },
  headerLogo: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartIconWrap: { position: 'relative' },
  cartDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: Colors.border },
  heroWrap: { height: 140, position: 'relative', overflow: 'hidden', backgroundColor: Colors.backgroundSecondary, justifyContent: 'center', alignItems: 'center' },
  heroImgFallback: { justifyContent: 'center', alignItems: 'center' },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroContent: { position: 'absolute', bottom: 10, left: 10, right: 10 },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  heroBadge: { color: Colors.neonBlue, fontSize: 7, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: Colors.white, fontSize: 12, fontWeight: '900', lineHeight: 16, marginBottom: 3 },
  heroSub: { color: Colors.textSecondary, fontSize: 8, lineHeight: 11, marginBottom: 6 },
  heroBtn: { backgroundColor: Colors.neonBlue, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  heroBtnText: { color: Colors.background, fontSize: 8, fontWeight: '800' },
  section: { padding: 10, backgroundColor: Colors.background },
  sectionTitle: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800', marginBottom: 3 },
  sectionSub: { color: Colors.textMuted, fontSize: 8, marginBottom: 8, lineHeight: 11 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  productCard: { width: '47%', backgroundColor: Colors.backgroundCard, borderRadius: 6, overflow: 'hidden' },
  productCardImg: { height: 50, backgroundColor: Colors.backgroundSecondary },
  productCardLine: { height: 6, backgroundColor: Colors.border, borderRadius: 3, margin: 6, marginBottom: 2 },
  canopySection: { padding: 12, alignItems: 'center', gap: 6, backgroundColor: Colors.backgroundSecondary },
  canopyBtn: { backgroundColor: Colors.neonBlue, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4, alignSelf: 'center' },
  testimRow: { flexDirection: 'row', gap: 5, marginTop: 6 },
  testimCard: { flex: 1, backgroundColor: Colors.backgroundCard, borderRadius: 6, padding: 7 },
  testimAuthor: { color: Colors.textMuted, fontSize: 7, marginTop: 5 },
  banner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  bannerText: { flex: 1, fontSize: 9, fontWeight: '700' },
  bannerLink: { fontSize: 9, fontWeight: '800' },
  footer: { backgroundColor: Colors.backgroundCard, padding: 10 },
  footerLogo: { color: Colors.textPrimary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 3 },
  footerTagline: { color: Colors.textMuted, fontSize: 7, marginBottom: 6 },
  footerDivider: { height: 1, backgroundColor: Colors.border, marginBottom: 8 },
  footerCols: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  footerCol: { flex: 1, gap: 3 },
  footerColTitle: { color: Colors.textPrimary, fontSize: 8, fontWeight: '800', marginBottom: 2 },
  footerColLink: { color: Colors.textMuted, fontSize: 7 },
  footerCopyright: { color: Colors.textMuted, fontSize: 7, marginTop: 4 },
  sectionRowWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: 'rgba(244,114,182,0.06)',
    borderLeftWidth: 2, borderLeftColor: '#F472B6',
  },
  sectionRowTitle: { flex: 1, color: Colors.textPrimary, fontSize: 9, fontWeight: '700' },
  sectionRowBadge: { backgroundColor: 'rgba(0,230,118,0.12)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  sectionRowBadgeOff: { backgroundColor: Colors.backgroundSecondary },
  sectionRowBadgeText: { color: Colors.success, fontSize: 7, fontWeight: '700' },
  sectionRowBadgeTextOff: { color: Colors.textMuted },
});

function PageBuilderScreen() {
  const { isMobile } = useAdminLayout();
  const { t } = useLanguage();
  if (isMobile) {
    return (
      <AdminMobileDashboard title={t.pageBuilder} showBack>
        <MobileUnsupported featureName={t.pageBuilder} />
      </AdminMobileDashboard>
    );
  }
  return (
    <PageBuilderProvider>
      <BuilderContent />
    </PageBuilderProvider>
  );
}

export default function PageBuilderScreenGuarded() {
  return (
    <AdminGuard permission="manage_cms_builder">
      <PageBuilderScreen />
    </AdminGuard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 60 },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.sm },
  retryBtn: {
    marginTop: 8,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 160,
    alignItems: 'center',
  },
  retryBtnText: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700' },

  toolbar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md, gap: Spacing.sm, flexWrap: 'wrap',
    paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  toolbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolbarTitle: { color: Colors.textPrimary, fontSize: FontSize.lg, fontWeight: '800' },
  pageTag: {
    backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2,
  },
  pageTagText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },

  undoRedoGroup: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: 2,
  },
  iconToolBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.sm },
  iconToolBtnDisabled: { opacity: 0.4 },

  previewToggle: {
    flexDirection: 'row', backgroundColor: Colors.backgroundCard,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 3, gap: 2,
  },
  previewToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.sm },
  previewToggleBtnActive: { backgroundColor: Colors.neonBlueGlow },
  previewToggleText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  previewToggleTextActive: { color: Colors.neonBlue },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1,
    borderColor: Colors.neonBlue, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: Colors.neonBlueGlow,
  },
  addBtnText: { color: Colors.neonBlue, fontSize: FontSize.sm, fontWeight: '700' },
  resetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1,
    borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 8,
  },
  resetBtnText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.neonBlue,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
  },
  saveBtnText: { color: Colors.background, fontSize: FontSize.sm, fontWeight: '800' },

  addPanel: {
    backgroundColor: Colors.backgroundCard, borderWidth: 1, borderColor: Colors.neonBlueBorder,
    borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md,
  },
  addPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  addPanelTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '700' },
  addPanelClose: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.sm, backgroundColor: Colors.backgroundSecondary },
  addPanelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  addPanelItem: {
    width: '30%', backgroundColor: Colors.backgroundSecondary, borderWidth: 1,
    borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', gap: 4,
  },
  addPanelIcon: { width: 34, height: 34, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  addPanelLabel: { color: Colors.textPrimary, fontSize: FontSize.xs, fontWeight: '700', textAlign: 'center' },
  addPanelDesc: { color: Colors.textMuted, fontSize: 9, textAlign: 'center', lineHeight: 12 },

  wideLayout: { flexDirection: 'row', gap: Spacing.lg, flex: 1, minHeight: 0 },
  editorCol: { flex: 1 },

  blockList: { gap: Spacing.sm, marginBottom: Spacing.lg },
  blockListHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.sm, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  blockListTitle: { color: Colors.textPrimary, fontSize: FontSize.md, fontWeight: '800' },
  blockListMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  blockListCount: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  blockListHint: { color: Colors.border, fontSize: FontSize.xs },

  blockItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.backgroundCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 12,
    position: 'relative', overflow: 'hidden',
  },
  blockItemActive: { borderColor: Colors.neonBlue, backgroundColor: Colors.neonBlueGlow },
  blockItemHidden: { opacity: 0.45 },
  blockItemDragging: { borderStyle: 'dashed', borderColor: Colors.neonBlue },
  blockActiveBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2 },
  blockGrip: { padding: 4, cursor: Platform.OS === 'web' ? 'grab' : 'default' },
  blockIcon: { width: 34, height: 34, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' },
  blockInfo: { flex: 1, minWidth: 0 },
  blockLabel: { color: Colors.textPrimary, fontSize: FontSize.sm, fontWeight: '700' },
  blockLabelHidden: { color: Colors.textMuted },
  blockDesc: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  blockActions: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  blockActionBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', borderRadius: Radius.sm },
  blockActionDivider: { width: 1, height: 16, backgroundColor: Colors.border, marginHorizontal: 2 },
  blockActionDelete: {},
  sectionRowLockBtn: { backgroundColor: 'rgba(244,114,182,0.1)', borderWidth: 1, borderColor: 'rgba(244,114,182,0.25)', borderRadius: Radius.sm },
  sectionRowLockText: { color: '#F472B6', fontSize: 11, fontWeight: '700' },

  dropZone: {
    height: 36, borderWidth: 2, borderStyle: 'dashed', borderRadius: Radius.md,
    justifyContent: 'center', alignItems: 'center', marginVertical: 4,
  },
  dropZoneText: { color: Colors.neonBlue, fontSize: FontSize.xs, fontWeight: '700' },

  settingsPanelWide: {
    width: 290, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start',
    maxHeight: '100%',
  },
  settingsPanelMobile: {
    borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
  },

  previewColumn: { width: IS_WIDE ? 270 : '100%', alignSelf: 'flex-start' },
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: Spacing.md, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  previewHeaderText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '700', flex: 1 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,230,118,0.12)', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  liveLabel: { color: Colors.success, fontSize: FontSize.xs, fontWeight: '700' },

  phoneFrame: {
    borderRadius: 28, overflow: 'hidden', borderWidth: 2, borderColor: Colors.navyLight,
    backgroundColor: Colors.background, maxHeight: 580,
    shadowColor: Colors.neonBlue, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 20,
  },
  phoneSpeaker: { width: 40, height: 4, backgroundColor: Colors.navyLight, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  phoneCamera: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.navyLight, alignSelf: 'center', marginBottom: 6 },
  phoneScroll: { flex: 1 },
  phoneHomeBar: { width: 50, height: 4, backgroundColor: Colors.navyLight, borderRadius: 2, alignSelf: 'center', marginVertical: 8 },

  previewBlock: { position: 'relative' },
  previewBlockActive: {},
  previewBlockBadge: {
    position: 'absolute', top: 4, right: 4, backgroundColor: Colors.neonBlue,
    borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2,
  },
  previewBlockBadgeText: { color: Colors.background, fontSize: 8, fontWeight: '800' },
});
