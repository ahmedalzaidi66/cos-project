import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase, adminSupabase } from '@/lib/supabase';
import { BRAND_CONFIG } from '@/config/brand';

export type BlockType =
  | 'header'
  | 'hero'
  | 'featured'
  | 'canopy'
  | 'testimonials'
  | 'banner'
  | 'footer'
  | 'section_row';

export type PageBlock = {
  id: string;
  type: BlockType;
  order_index: number;
  visible: boolean;
  content: Record<string, any>;
};

export type PageLayout = {
  id: string;
  page: string;
};

export const DEFAULT_BLOCK_CONTENT: Record<BlockType, Record<string, any>> = {
  header: { show_cart: true, show_account: true },
  hero: {
    image_url: 'https://images.pexels.com/photos/2533266/pexels-photo-2533266.jpeg?auto=compress&cs=tinysrgb&w=800',
    badge_text: 'PREMIUM MAKEUP',
    title: 'Elevate Your Beauty',
    subtitle: 'Premium makeup loved by beauty enthusiasts worldwide',
    cta_primary: 'Shop Now',
    cta_secondary: 'View Best Sellers',
    overlay_color: 'rgba(10,5,7,0.55)',
  },
  featured: { title: 'Best Sellers', subtitle: 'Curated by our beauty experts', max_products: 6, layout: 'grid' },
  canopy: { title: 'Skincare', subtitle: 'Explore our skincare collection coming soon.', cta_text: 'Coming Soon', bg_color: '' },
  testimonials: { title: 'Loved by Makeup Enthusiasts', subtitle: 'Hear from our community', max_items: 6 },
  banner: { text: 'Free shipping on orders over $50', link_text: 'Shop Now', link_url: '', bg_color: '#FF4D8D', text_color: '#FFFFFF' },
  footer: {
    tagline: 'Premium makeup for every skin tone.',
    copyright: BRAND_CONFIG.copyrightText,
    col1_title: 'Shop', col2_title: 'Company', col3_title: 'Support',
    contact_email: BRAND_CONFIG.supportEmail, contact_phone: BRAND_CONFIG.supportPhone,
  },
  section_row: { section_id: '', title_en: '', title_ar: '', is_active: true },
};

export const DEFAULT_BLOCKS: Omit<PageBlock, 'id'>[] = [
  { type: 'header',       order_index: 0, visible: true,  content: DEFAULT_BLOCK_CONTENT.header },
  { type: 'hero',         order_index: 1, visible: true,  content: DEFAULT_BLOCK_CONTENT.hero },
  { type: 'featured',     order_index: 2, visible: true,  content: DEFAULT_BLOCK_CONTENT.featured },
  { type: 'canopy',       order_index: 3, visible: true,  content: DEFAULT_BLOCK_CONTENT.canopy },
  { type: 'testimonials', order_index: 4, visible: true,  content: DEFAULT_BLOCK_CONTENT.testimonials },
  { type: 'banner',       order_index: 5, visible: false, content: DEFAULT_BLOCK_CONTENT.banner },
  { type: 'footer',       order_index: 6, visible: true,  content: DEFAULT_BLOCK_CONTENT.footer },
];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type PageBuilderContextType = {
  layout: PageLayout | null;
  blocks: PageBlock[];
  loading: boolean;
  loadError: string | null;
  saving: boolean;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  moveBlock: (id: string, direction: 'up' | 'down') => void;
  toggleBlockVisibility: (id: string) => void;
  updateBlockContent: (id: string, content: Record<string, any>) => void;
  addBlock: (type: BlockType) => void;
  removeBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  saveLayout: () => Promise<void>;
  restoreDefaults: () => void;
  createDefaultLayout: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  refresh: () => Promise<void>;
};

const PageBuilderContext = createContext<PageBuilderContextType | undefined>(undefined);

const MAX_HISTORY = 50;

export function PageBuilderProvider({ children }: { children: React.ReactNode }) {
  const [layout, setLayout] = useState<PageLayout | null>(null);
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const historyRef = useRef<PageBlock[][]>([]);
  const historyIndexRef = useRef(-1);
  const skipHistoryRef = useRef(false);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((newBlocks: PageBlock[]) => {
    if (skipHistoryRef.current) return;
    const history = historyRef.current;
    const idx = historyIndexRef.current;
    const slice = history.slice(0, idx + 1);
    slice.push(newBlocks.map(b => ({ ...b, content: { ...b.content } })));
    if (slice.length > MAX_HISTORY) slice.shift();
    historyRef.current = slice;
    historyIndexRef.current = slice.length - 1;
    setCanUndo(slice.length > 1);
    setCanRedo(false);
  }, []);

  const setBlocksWithHistory = useCallback((updater: (prev: PageBlock[]) => PageBlock[]) => {
    setBlocks(prev => {
      const next = updater(prev);
      pushHistory(next);
      return next;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    const history = historyRef.current;
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    const newIdx = idx - 1;
    historyIndexRef.current = newIdx;
    skipHistoryRef.current = true;
    setBlocks(history[newIdx].map(b => ({ ...b, content: { ...b.content } })));
    skipHistoryRef.current = false;
    setCanUndo(newIdx > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const history = historyRef.current;
    const idx = historyIndexRef.current;
    if (idx >= history.length - 1) return;
    const newIdx = idx + 1;
    historyIndexRef.current = newIdx;
    skipHistoryRef.current = true;
    setBlocks(history[newIdx].map(b => ({ ...b, content: { ...b.content } })));
    skipHistoryRef.current = false;
    setCanUndo(true);
    setCanRedo(newIdx < history.length - 1);
  }, []);

  function initBlocks(initial: PageBlock[]) {
    skipHistoryRef.current = true;
    setBlocks(initial);
    skipHistoryRef.current = false;
    historyRef.current = [initial.map(b => ({ ...b, content: { ...b.content } }))];
    historyIndexRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
  }

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const { data: layoutData, error: layoutError } = await supabase
      .from('page_layouts').select('*').eq('page', 'home').maybeSingle();

    if (layoutError) {
      setLoadError(layoutError.message);
      setLoading(false);
      return;
    }

    if (!layoutData) {
      setLayout(null);
      initBlocks(DEFAULT_BLOCKS.map((b, i) => ({ ...b, id: `temp-${i}` })));
      setLoading(false);
      return;
    }

    setLayout(layoutData);

    // Load ALL page_blocks including section_row type — unified order
    const { data: blocksData, error: blocksError } = await supabase
      .from('page_blocks').select('*').eq('layout_id', layoutData.id)
      .order('order_index', { ascending: true });

    if (blocksError) {
      setLoadError(blocksError.message);
      setLoading(false);
      return;
    }

    // Enrich section_row blocks with live section data (title may have changed)
    let allBlocks: PageBlock[] = blocksData && blocksData.length > 0
      ? (blocksData as PageBlock[])
      : DEFAULT_BLOCKS.map((b, i) => ({ ...b, id: `temp-${i}` }));

    const sectionIds = allBlocks
      .filter(b => b.type === 'section_row' && b.content?.section_id)
      .map(b => b.content.section_id as string);

    if (sectionIds.length > 0) {
      const { data: sectionsData } = await supabase
        .from('homepage_sections')
        .select('id, title_en, title_ar, is_active')
        .in('id', sectionIds);

      if (sectionsData) {
        const sectionMap = new Map(sectionsData.map(s => [s.id, s]));
        allBlocks = allBlocks.map(b => {
          if (b.type !== 'section_row') return b;
          const sec = sectionMap.get(b.content.section_id);
          if (!sec) return b;
          return {
            ...b,
            visible: sec.is_active,
            content: { ...b.content, title_en: sec.title_en, title_ar: sec.title_ar, is_active: sec.is_active },
          };
        });
      }
    }

    initBlocks(allBlocks);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const moveBlock = useCallback((id: string, direction: 'up' | 'down') => {
    setBlocksWithHistory((prev) => {
      const sorted = [...prev].sort((a, b) => a.order_index - b.order_index);
      const idx = sorted.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sorted.length) return prev;
      const next = [...sorted];
      const tmp = next[idx].order_index;
      next[idx] = { ...next[idx], order_index: next[targetIdx].order_index };
      next[targetIdx] = { ...next[targetIdx], order_index: tmp };
      return next;
    });
  }, [setBlocksWithHistory]);

  const toggleBlockVisibility = useCallback((id: string) => {
    setBlocksWithHistory((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const newVisible = !b.visible;
        // Keep section_row content.is_active in sync with visible
        if (b.type === 'section_row') {
          return { ...b, visible: newVisible, content: { ...b.content, is_active: newVisible } };
        }
        return { ...b, visible: newVisible };
      })
    );
  }, [setBlocksWithHistory]);

  const updateBlockContent = useCallback((id: string, content: Record<string, any>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content: { ...b.content, ...content } } : b))
    );
  }, []);

  const addBlock = useCallback((type: BlockType) => {
    if (type === 'section_row') return; // section_rows are managed from Sections admin
    setBlocksWithHistory((prev) => {
      const sorted = [...prev].sort((a, b) => a.order_index - b.order_index);
      const maxOrder = sorted.length > 0 ? sorted[sorted.length - 1].order_index + 1 : 0;
      const newBlock: PageBlock = {
        id: `new-${Date.now()}`,
        type,
        order_index: maxOrder,
        visible: true,
        content: { ...DEFAULT_BLOCK_CONTENT[type] },
      };
      setSelectedBlockId(newBlock.id);
      return [...prev, newBlock];
    });
  }, [setBlocksWithHistory]);

  const removeBlock = useCallback((id: string) => {
    // Prevent removing section_row blocks — they're managed from Sections admin
    if (blocks.find(b => b.id === id)?.type === 'section_row') return;
    setBlocksWithHistory((prev) => prev.filter((b) => b.id !== id));
    setSelectedBlockId(null);
  }, [setBlocksWithHistory, blocks]);

  const duplicateBlock = useCallback((id: string) => {
    if (blocks.find(b => b.id === id)?.type === 'section_row') return;
    setBlocksWithHistory((prev) => {
      const block = prev.find((b) => b.id === id);
      if (!block) return prev;
      const sorted = [...prev].sort((a, b) => a.order_index - b.order_index);
      const maxOrder = sorted[sorted.length - 1].order_index + 1;
      return [...prev, { ...block, id: `dup-${Date.now()}`, order_index: maxOrder }];
    });
  }, [setBlocksWithHistory, blocks]);

  const saveLayout = useCallback(async () => {
    if (!layout) return;
    setSaving(true);
    setSaveStatus('saving');

    const db = adminSupabase();
    const sorted = [...blocks].sort((a, b) => a.order_index - b.order_index);

    // Delete all existing page_blocks for this layout and re-insert in new order.
    // This handles both regular blocks and section_row blocks in one unified write.
    await db.from('page_blocks').delete().eq('layout_id', layout.id);

    const rows = sorted.map((b, i) => ({
      layout_id: layout.id,
      type: b.type,
      order_index: i,
      visible: b.visible,
      content: b.content,
      updated_at: new Date().toISOString(),
    }));

    const { data: inserted, error } = await db.from('page_blocks').insert(rows).select();

    if (error) {
      setSaveStatus('error');
      setSaving(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
      return;
    }

    // Sync section_row visibility → homepage_sections.is_active
    const sectionBlocks = sorted.filter(b => b.type === 'section_row' && b.content?.section_id);
    if (sectionBlocks.length > 0) {
      await Promise.all(
        sectionBlocks.map(b =>
          db.from('homepage_sections')
            .update({ is_active: b.visible })
            .eq('id', b.content.section_id)
        )
      );
    }

    // Update layout timestamp
    await db.from('page_layouts').update({ updated_at: new Date().toISOString() }).eq('id', layout.id);

    // Sync local state with DB-assigned IDs
    if (inserted) {
      skipHistoryRef.current = true;
      setBlocks(inserted as PageBlock[]);
      skipHistoryRef.current = false;
    }

    setSaving(false);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 3000);
  }, [layout, blocks]);

  const restoreDefaults = useCallback(() => {
    setBlocksWithHistory((prev) => {
      // Keep existing section_row blocks when restoring defaults
      const sectionRows = prev.filter(b => b.type === 'section_row');
      const defaults = DEFAULT_BLOCKS.map((b, i) => ({ ...b, id: `temp-${i}` }));
      const maxOrder = defaults.reduce((m, b) => Math.max(m, b.order_index), 0);
      const reindexedSections = sectionRows.map((b, i) => ({
        ...b,
        order_index: maxOrder + 1 + i,
      }));
      return [...defaults, ...reindexedSections];
    });
    setSelectedBlockId(null);
  }, [setBlocksWithHistory]);

  const createDefaultLayout = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const db = adminSupabase();
    const { data: existing } = await supabase
      .from('page_layouts').select('id').eq('page', 'home').maybeSingle();
    let layoutId = existing?.id;
    if (!layoutId) {
      const { data: created, error } = await db
        .from('page_layouts').insert({ page: 'home' }).select().maybeSingle();
      if (error || !created) {
        setLoadError('Failed to create default layout');
        setLoading(false);
        return;
      }
      layoutId = created.id;
    }
    const rows = DEFAULT_BLOCKS.map((b, i) => ({
      layout_id: layoutId,
      type: b.type,
      order_index: i,
      visible: b.visible,
      content: b.content,
    }));
    await db.from('page_blocks').delete().eq('layout_id', layoutId);
    await db.from('page_blocks').insert(rows);
    await refresh();
  }, [refresh]);

  return (
    <PageBuilderContext.Provider value={{
      layout, blocks, loading, loadError, saving, saveStatus, canUndo, canRedo,
      selectedBlockId, setSelectedBlockId,
      moveBlock, toggleBlockVisibility, updateBlockContent,
      addBlock, removeBlock, duplicateBlock,
      saveLayout, restoreDefaults, createDefaultLayout, undo, redo, refresh,
    }}>
      {children}
    </PageBuilderContext.Provider>
  );
}

export function usePageBuilder() {
  const ctx = useContext(PageBuilderContext);
  if (!ctx) throw new Error('usePageBuilder must be used inside PageBuilderProvider');
  return ctx;
}
