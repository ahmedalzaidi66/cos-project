import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { fetchCMSContent, fetchThemeSettings, CMSContent as CMSRow, ThemeSettings } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';

export type SectionMap = Record<string, string>;
export type CMSContent = Record<string, SectionMap>;

export type Branding = {
  logo_url: string;
  app_name: string;
  app_tagline: string;
  header_icons: string;
};

const DEFAULT_BRANDING: Branding = {
  logo_url: '',
  app_name: 'LAZURDE',
  app_tagline: 'MAKEUP',
  header_icons: 'true',
};

type CMSContextType = {
  content: CMSContent;
  branding: Branding;
  cmsRow: CMSRow | null;
  theme: ThemeSettings | null;
  loading: boolean;
  refresh: (language?: string) => Promise<void>;
  setContent: React.Dispatch<React.SetStateAction<CMSContent>>;
  setBranding: React.Dispatch<React.SetStateAction<Branding>>;
  currentLanguage: string;
  setCurrentLanguage: (lang: string) => void;
};

declare global {
  var __CMSContext: React.Context<CMSContextType | undefined> | undefined;
}

if (!global.__CMSContext) {
  global.__CMSContext = createContext<CMSContextType | undefined>(undefined);
}

const CMSContext = global.__CMSContext;

export { DEFAULT_BRANDING };

/** Merges two SectionMap objects, using fallback values only for keys that are empty/missing. */
function mergeSections(primary: SectionMap, fallback: SectionMap): SectionMap {
  const result: SectionMap = { ...fallback };
  for (const key of Object.keys(primary)) {
    if (primary[key] !== undefined && primary[key] !== null && primary[key] !== '') {
      result[key] = primary[key];
    }
  }
  return result;
}

/** Merges two CMSContent maps with section-level fallback. */
function mergeCMSContent(primary: CMSContent, fallback: CMSContent): CMSContent {
  const result: CMSContent = {};
  const allSections = new Set([...Object.keys(primary), ...Object.keys(fallback)]);
  allSections.forEach((section) => {
    if (primary[section] && fallback[section]) {
      result[section] = mergeSections(primary[section], fallback[section]);
    } else {
      result[section] = primary[section] ?? fallback[section];
    }
  });
  return result;
}

function buildCMSMap(row: CMSRow): CMSContent {
  return {
    hero: {
      title: row.hero_title,
      subtitle: row.hero_subtitle,
      button_text: row.hero_button_text,
      cta_primary: row.hero_button_text,
      image_url: row.hero_image,
    },
    featured: { title: row.featured_title },
    canopy: { title: row.canopy_title, description: row.canopy_description },
    testimonials: { title: row.testimonial_title },
    footer: { text: row.footer_text },
    branding: { logo_url: row.logo },
  };
}

async function fetchHomepageContentMap(lang: string): Promise<CMSContent> {
  const { data } = await supabase
    .from('homepage_content')
    .select('section, key, value')
    .eq('language', lang);
  const map: CMSContent = {};
  for (const row of (data ?? []) as { section: string; key: string; value: string }[]) {
    if (!map[row.section]) map[row.section] = {};
    if (row.value !== null && row.value !== undefined) {
      map[row.section][row.key] = row.value;
    }
  }
  return map;
}

export function CMSProvider({ children }: { children: React.ReactNode }) {
  const { language: contextLanguage } = useLanguage();

  const [content, setContent] = useState<CMSContent>({});
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [cmsRow, setCmsRow] = useState<CMSRow | null>(null);
  const [theme, setTheme] = useState<ThemeSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Track which language the currently-in-flight fetch was started for.
  // Any fetch that completes for a stale language is silently discarded.
  const fetchingForLanguage = useRef<string>(contextLanguage);

  const refresh = useCallback(async (language?: string) => {
    const lang = language ?? contextLanguage;

    // Record which language this fetch is for BEFORE any await
    fetchingForLanguage.current = lang;
    setLoading(true);

    const [cmsResult, themeResult, brandingRes, legacyRes, enCmsResult, enLegacyRes] =
      await Promise.allSettled([
        fetchCMSContent(lang),
        fetchThemeSettings(),
        supabase.from('site_branding').select('key, value'),
        fetchHomepageContentMap(lang),
        lang !== 'en' ? fetchCMSContent('en') : Promise.resolve(null),
        lang !== 'en' ? fetchHomepageContentMap('en') : Promise.resolve({}),
      ]);

    // Discard result if the language changed while this fetch was in-flight
    if (fetchingForLanguage.current !== lang) return;

    // Build English fallback maps (only used to fill genuinely missing keys)
    const enCmsMap: CMSContent =
      enCmsResult.status === 'fulfilled' && enCmsResult.value
        ? buildCMSMap(enCmsResult.value)
        : {};
    const enLegacyMap: CMSContent =
      enLegacyRes.status === 'fulfilled' && enLegacyRes.value
        ? (enLegacyRes.value as CMSContent)
        : {};
    const enFallback = mergeCMSContent(enLegacyMap, enCmsMap);

    // Build language-specific maps
    const legacyMap: CMSContent =
      legacyRes.status === 'fulfilled' ? (legacyRes.value as CMSContent) : {};

    let newRow: CMSRow | null = null;
    if (cmsResult.status === 'fulfilled' && cmsResult.value) {
      newRow = cmsResult.value;
      setCmsRow(newRow);
    }

    const cmsMap: CMSContent = newRow ? buildCMSMap(newRow) : {};

    // Merge: cms_content base + homepage_content overrides
    const langContent: CMSContent = mergeCMSContent(legacyMap, cmsMap);

    // Apply English fallback only for keys that are genuinely absent in the target language
    const merged = lang === 'en' ? langContent : mergeCMSContent(langContent, enFallback);

    // Replace content entirely — never spread prev which would mix old-language data
    setContent(merged);

    if (themeResult.status === 'fulfilled') {
      setTheme(themeResult.value);
    }

    if (brandingRes.status === 'fulfilled' && brandingRes.value.data) {
      const b: Partial<Branding> = {};
      (brandingRes.value.data as { key: string; value: string }[]).forEach((row) => {
        (b as any)[row.key] = row.value;
      });
      setBranding((prev) => ({ ...prev, ...b }));
    }

    setLoading(false);
  // Intentionally omit contextLanguage from deps — language is always passed explicitly
  // by the useEffect below, so the closure value doesn't matter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Clear stale content immediately on language change so components never
    // briefly show the old language while the new fetch is in-flight.
    setContent({});
    setLoading(true);
    refresh(contextLanguage);
  }, [contextLanguage, refresh]);

  return (
    <CMSContext.Provider
      value={{
        content,
        branding,
        cmsRow,
        theme,
        loading,
        refresh,
        setContent,
        setBranding,
        currentLanguage: contextLanguage,
        setCurrentLanguage: (_lang: string) => {},
      }}
    >
      {children}
    </CMSContext.Provider>
  );
}

export function useCMS() {
  const ctx = useContext(CMSContext);
  if (!ctx) throw new Error('useCMS must be inside CMSProvider');
  return ctx;
}
