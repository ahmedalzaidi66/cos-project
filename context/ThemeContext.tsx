import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { DarkColors, LightColors } from '@/constants/theme';

export type AppThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'customer_app_theme';

function readPersistedTheme(): AppThemeMode {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light') return 'light';
    if (v === 'dark') return 'dark';
  }
  return 'dark';
}

function persistTheme(mode: AppThemeMode) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  }
}

type ThemeContextType = {
  mode: AppThemeMode;
  C: typeof DarkColors;
  theme: { primary: string; background: string; text: string; accent: string };
};

const DARK_COMPAT = { primary: '#FF4D8D', background: '#0A0507', text: '#FDE8F0', accent: '#FF4D8D' };
const LIGHT_COMPAT = { primary: '#FF4D8D', background: '#FFFFFF', text: '#1A0A14', accent: '#FF4D8D' };

// Kept for legacy callers that import DEFAULT_THEME
export const DEFAULT_THEME = DARK_COMPAT;

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  C: DarkColors,
  theme: DARK_COMPAT,
});

function injectCSSVars(C: typeof DarkColors) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--primary',          C.neonBlue);
  root.style.setProperty('--bg',               C.background);
  root.style.setProperty('--text',             C.textPrimary);
  root.style.setProperty('--accent',           C.neonBlue);
  root.style.setProperty('--primary-color',    C.neonBlue);
  root.style.setProperty('--background-color', C.background);
  root.style.setProperty('--text-primary',     C.textPrimary);
  root.style.setProperty('--accent-color',     C.neonBlue);
  document.body.style.backgroundColor = C.background;
}

function applyMode(mode: AppThemeMode) {
  injectCSSVars(mode === 'light' ? LightColors : DarkColors);
  persistTheme(mode);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Read from localStorage synchronously so first render uses the correct theme
  const [mode, setMode] = useState<AppThemeMode>(() => {
    const persisted = readPersistedTheme();
    // Apply CSS vars immediately for web — prevents flash
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      injectCSSVars(persisted === 'light' ? LightColors : DarkColors);
    }
    return persisted;
  });

  useEffect(() => {
    // Background fetch from Supabase — updates if admin changed value
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'customer_app_theme')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn('[ThemeContext] fetch error:', error.message);
          return;
        }
        const raw = data?.value ?? 'dark';
        const resolved: AppThemeMode = raw === 'light' ? 'light' : 'dark';
        setMode(resolved);
        applyMode(resolved);
      });

    // Realtime: update while app is open when admin changes the setting
    const channel = supabase
      .channel('customer_app_theme_watch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings', filter: 'key=eq.customer_app_theme' },
        (payload) => {
          const newVal = (payload.new as { value?: string })?.value;
          const resolved: AppThemeMode = newVal === 'light' ? 'light' : 'dark';
          setMode(resolved);
          applyMode(resolved);
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []);

  const C = mode === 'light' ? LightColors : DarkColors;
  const compat = mode === 'light' ? LIGHT_COMPAT : DARK_COMPAT;

  return (
    <ThemeContext.Provider value={{ mode, C, theme: compat }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Convenience hook — returns just the color palette for the current theme
export function useAppColors() {
  return useContext(ThemeContext).C;
}

// Returns mode string — useful for conditional rendering based on theme
export function useThemeMode(): AppThemeMode {
  return useContext(ThemeContext).mode;
}
