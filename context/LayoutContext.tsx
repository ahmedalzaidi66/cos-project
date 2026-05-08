import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase, adminSupabase } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export type SpacingBreakpoint = {
  marginTop: number;
  marginBottom: number;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  maxWidth: number;
  borderRadius: number;
};

export type Typography = {
  headingSize: number;
  headingMarginBottom: number;
  subtitleSize: number;
  subtitleMarginBottom: number;
  buttonSize: number;
  buttonPaddingH: number;
  buttonPaddingV: number;
  cardGap: number;
};

export type LayoutOptions = {
  heroHeight: number;
  alignment: 'left' | 'center' | 'right';
  contentWidth: number;
  imageAspectRatio: number;
  gridColumns?: number;
  cardGap?: number;
};

export type SectionLayout = {
  id: string;
  section_id: string;
  label: string;
  mobile: SpacingBreakpoint;
  tablet: SpacingBreakpoint;
  desktop: SpacingBreakpoint;
  typography: Typography;
  layout: LayoutOptions;
};

export type SectionId = 'header' | 'hero' | 'featured' | 'canopy' | 'testimonials' | 'banner' | 'footer' | 'products';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_SPACING: SpacingBreakpoint = {
  marginTop: 0, marginBottom: 0,
  paddingTop: 16, paddingBottom: 16,
  paddingLeft: 16, paddingRight: 16,
  maxWidth: 0, borderRadius: 0,
};

const DEFAULT_TYPOGRAPHY: Typography = {
  headingSize: 18, headingMarginBottom: 4,
  subtitleSize: 13, subtitleMarginBottom: 8,
  buttonSize: 14, buttonPaddingH: 16, buttonPaddingV: 10,
  cardGap: 8,
};

const DEFAULT_LAYOUT: LayoutOptions = {
  heroHeight: 0, alignment: 'left', contentWidth: 100,
  imageAspectRatio: 1, gridColumns: 2, cardGap: 8,
};

export const SECTION_DEFAULTS: Record<SectionId, SectionLayout> = {
  header: {
    id: '', section_id: 'header', label: 'Header',
    mobile: { ...DEFAULT_SPACING, paddingLeft: 16, paddingRight: 16 },
    tablet: { ...DEFAULT_SPACING, paddingLeft: 16, paddingRight: 16 },
    desktop: { ...DEFAULT_SPACING, paddingLeft: 24, paddingRight: 24, maxWidth: 1200 },
    typography: { ...DEFAULT_TYPOGRAPHY, headingSize: 18, buttonSize: 13 },
    layout: { ...DEFAULT_LAYOUT, alignment: 'left' },
  },
  hero: {
    id: '', section_id: 'hero', label: 'Hero Banner',
    mobile: { ...DEFAULT_SPACING, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
    tablet: { ...DEFAULT_SPACING, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
    desktop: { ...DEFAULT_SPACING, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
    typography: { ...DEFAULT_TYPOGRAPHY, headingSize: 32, headingMarginBottom: 6, subtitleSize: 13 },
    layout: { ...DEFAULT_LAYOUT, heroHeight: 220, alignment: 'left' },
  },
  featured: {
    id: '', section_id: 'featured', label: 'Featured Products',
    mobile: { ...DEFAULT_SPACING, paddingTop: 8, paddingBottom: 8 },
    tablet: { ...DEFAULT_SPACING, paddingTop: 8, paddingBottom: 8 },
    desktop: { ...DEFAULT_SPACING, paddingTop: 16, paddingBottom: 16, paddingLeft: 24, paddingRight: 24, maxWidth: 1200 },
    typography: { ...DEFAULT_TYPOGRAPHY, headingSize: 18, headingMarginBottom: 4 },
    layout: { ...DEFAULT_LAYOUT, gridColumns: 2, cardGap: 8 },
  },
  canopy: {
    id: '', section_id: 'canopy', label: 'Beauty Filter',
    mobile: { ...DEFAULT_SPACING, marginTop: 24, marginBottom: 24, paddingTop: 32, paddingBottom: 32, borderRadius: 16 },
    tablet: { ...DEFAULT_SPACING, marginTop: 24, marginBottom: 24, paddingTop: 32, paddingBottom: 32, paddingLeft: 24, paddingRight: 24, borderRadius: 16 },
    desktop: { ...DEFAULT_SPACING, marginTop: 32, marginBottom: 32, paddingTop: 40, paddingBottom: 40, paddingLeft: 32, paddingRight: 32, maxWidth: 800, borderRadius: 16 },
    typography: { ...DEFAULT_TYPOGRAPHY, headingSize: 22, headingMarginBottom: 8, subtitleSize: 13 },
    layout: { ...DEFAULT_LAYOUT, alignment: 'center' },
  },
  testimonials: {
    id: '', section_id: 'testimonials', label: 'Testimonials',
    mobile: { ...DEFAULT_SPACING, paddingTop: 24, paddingBottom: 24, paddingLeft: 0, paddingRight: 0 },
    tablet: { ...DEFAULT_SPACING, paddingTop: 24, paddingBottom: 24, paddingLeft: 0, paddingRight: 0 },
    desktop: { ...DEFAULT_SPACING, paddingTop: 32, paddingBottom: 32, paddingLeft: 0, paddingRight: 0 },
    typography: { ...DEFAULT_TYPOGRAPHY, headingSize: 18, headingMarginBottom: 4 },
    layout: { ...DEFAULT_LAYOUT, contentWidth: 200, cardGap: 8 },
  },
  banner: {
    id: '', section_id: 'banner', label: 'Promo Banner',
    mobile: { ...DEFAULT_SPACING, paddingTop: 10, paddingBottom: 10 },
    tablet: { ...DEFAULT_SPACING, paddingTop: 10, paddingBottom: 10 },
    desktop: { ...DEFAULT_SPACING, paddingTop: 10, paddingBottom: 10, paddingLeft: 24, paddingRight: 24 },
    typography: { ...DEFAULT_TYPOGRAPHY, headingSize: 13, subtitleSize: 11 },
    layout: { ...DEFAULT_LAYOUT, alignment: 'center' },
  },
  footer: {
    id: '', section_id: 'footer', label: 'Footer',
    mobile: { ...DEFAULT_SPACING, paddingTop: 32, paddingBottom: 32 },
    tablet: { ...DEFAULT_SPACING, paddingTop: 32, paddingBottom: 32 },
    desktop: { ...DEFAULT_SPACING, paddingTop: 48, paddingBottom: 48, paddingLeft: 24, paddingRight: 24, maxWidth: 1200 },
    typography: { ...DEFAULT_TYPOGRAPHY, headingSize: 15, headingMarginBottom: 12 },
    layout: { ...DEFAULT_LAYOUT, gridColumns: 3 },
  },
  products: {
    id: '', section_id: 'products', label: 'Product Grid',
    mobile: { ...DEFAULT_SPACING, paddingBottom: 48 },
    tablet: { ...DEFAULT_SPACING, paddingBottom: 48 },
    desktop: { ...DEFAULT_SPACING, paddingBottom: 48, paddingLeft: 24, paddingRight: 24, maxWidth: 1200 },
    typography: { ...DEFAULT_TYPOGRAPHY, headingSize: 15 },
    layout: { ...DEFAULT_LAYOUT, gridColumns: 2, cardGap: 8 },
  },
};

// ─── Context ─────────────────────────────────────────────────────────────────

type LayoutContextType = {
  sections: Record<SectionId, SectionLayout>;
  loading: boolean;
  loadError: string | null;
  getSectionLayout: (id: SectionId) => SectionLayout;
  updateSection: (id: SectionId, updates: Partial<SectionLayout>) => void;
  saveSection: (id: SectionId) => Promise<{ error?: string }>;
  saveAll: () => Promise<{ error?: string }>;
  resetSection: (id: SectionId) => void;
  resetAll: () => void;
  refresh: () => Promise<void>;
};

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [sections, setSections] = useState<Record<SectionId, SectionLayout>>({ ...SECTION_DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    console.log('[LayoutContext] Loading layout settings...');
    const { data, error } = await supabase.from('layout_settings').select('*');
    if (error) {
      console.error('[LayoutContext] Fetch error:', error.message);
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const rowCount = data?.length ?? 0;
    console.log('[LayoutContext] Fetched rows:', rowCount);

    if (rowCount === 0) {
      console.warn('[LayoutContext] No layout_settings rows found — seeding defaults...');
      const seedRows = (Object.keys(SECTION_DEFAULTS) as SectionId[]).map(sid => {
        const d = SECTION_DEFAULTS[sid];
        return {
          section_id: sid,
          label: d.label,
          mobile: d.mobile,
          tablet: d.tablet,
          desktop: d.desktop,
          typography: d.typography,
          layout: d.layout,
        };
      });
      const { error: seedError } = await supabase
        .from('layout_settings')
        .upsert(seedRows, { onConflict: 'section_id' });
      if (seedError) {
        console.error('[LayoutContext] Seed error:', seedError.message);
      } else {
        console.log('[LayoutContext] Default rows seeded successfully');
      }
      setLoading(false);
      return;
    }

    if (data) {
      const map: Record<string, SectionLayout> = {};
      for (const row of data) {
        map[row.section_id] = {
          id: row.id,
          section_id: row.section_id,
          label: row.label,
          mobile:     { ...DEFAULT_SPACING,     ...(row.mobile     ?? {}) },
          tablet:     { ...DEFAULT_SPACING,     ...(row.tablet     ?? {}) },
          desktop:    { ...DEFAULT_SPACING,     ...(row.desktop    ?? {}) },
          typography: { ...DEFAULT_TYPOGRAPHY,  ...(row.typography ?? {}) },
          layout:     { ...DEFAULT_LAYOUT,      ...(row.layout     ?? {}) },
        };
      }
      setSections(prev => {
        const next = { ...prev };
        for (const sid of Object.keys(map) as SectionId[]) {
          if (sid in SECTION_DEFAULTS) next[sid] = map[sid];
        }
        return next;
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getSectionLayout = useCallback((id: SectionId): SectionLayout => {
    return sections[id] ?? SECTION_DEFAULTS[id];
  }, [sections]);

  const updateSection = useCallback((id: SectionId, updates: Partial<SectionLayout>) => {
    setSections(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates },
    }));
  }, []);

  const saveSection = useCallback(async (id: SectionId): Promise<{ error?: string }> => {
    const section = sections[id];
    const payload = {
      section_id: id,
      label: section.label,
      mobile: section.mobile,
      tablet: section.tablet,
      desktop: section.desktop,
      typography: section.typography,
      layout: section.layout,
      updated_at: new Date().toISOString(),
    };

    const db = adminSupabase();
    if (section.id) {
      const { error } = await db.from('layout_settings').update(payload).eq('id', section.id);
      if (error) return { error: error.message };
    } else {
      const { data, error } = await db.from('layout_settings').insert(payload).select().maybeSingle();
      if (error) return { error: error.message };
      if (data) setSections(prev => ({ ...prev, [id]: { ...prev[id], id: data.id } }));
    }
    return {};
  }, [sections]);

  const saveAll = useCallback(async (): Promise<{ error?: string }> => {
    for (const id of Object.keys(sections) as SectionId[]) {
      const result = await saveSection(id);
      if (result.error) return result;
    }
    return {};
  }, [sections, saveSection]);

  const resetSection = useCallback((id: SectionId) => {
    setSections(prev => ({
      ...prev,
      [id]: { ...SECTION_DEFAULTS[id], id: prev[id]?.id ?? '' },
    }));
  }, []);

  const resetAll = useCallback(() => {
    setSections(prev => {
      const next = { ...prev };
      for (const id of Object.keys(SECTION_DEFAULTS) as SectionId[]) {
        next[id] = { ...SECTION_DEFAULTS[id], id: prev[id]?.id ?? '' };
      }
      return next;
    });
  }, []);

  return (
    <LayoutContext.Provider value={{
      sections, loading, loadError,
      getSectionLayout, updateSection,
      saveSection, saveAll,
      resetSection, resetAll, refresh,
    }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used inside LayoutProvider');
  return ctx;
}
