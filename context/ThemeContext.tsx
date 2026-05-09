import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { DarkColors, LightColors } from '@/constants/theme';

export type AppThemeMode = 'dark' | 'light';

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AppThemeMode>('dark');

  useEffect(() => {
    // Initial fetch
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'customer_app_theme')
      .maybeSingle()
      .then(({ data }) => {
        const resolved: AppThemeMode = data?.value === 'light' ? 'light' : 'dark';
        setMode(resolved);
        injectCSSVars(resolved === 'light' ? LightColors : DarkColors);
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
          injectCSSVars(resolved === 'light' ? LightColors : DarkColors);
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
