import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform, Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { DarkColors, LightColors } from '@/constants/theme';

export type AppThemeMode = 'dark' | 'light';
export type UserThemePreference = 'light' | 'dark' | 'system';

const USER_PREF_KEY = 'user_theme_preference';

const DARK_COMPAT  = { primary: '#FF4D8D', background: '#0A0507', text: '#FDE8F0', accent: '#FF4D8D' };
const LIGHT_COMPAT = { primary: '#FF4D8D', background: '#FFFFFF', text: '#1A0A14', accent: '#FF4D8D' };

export const DEFAULT_THEME = DARK_COMPAT;

type ThemeContextType = {
  mode: AppThemeMode;
  userPref: UserThemePreference;
  setUserPref: (pref: UserThemePreference) => void;
  C: typeof DarkColors;
  theme: typeof DARK_COMPAT;
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  userPref: 'system',
  setUserPref: () => {},
  C: DarkColors,
  theme: DARK_COMPAT,
});

// ── Storage helpers ───────────────────────────────────────────────────────────

function readPrefWeb(): UserThemePreference | null {
  if (typeof localStorage === 'undefined') return null;
  const v = localStorage.getItem(USER_PREF_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return null;
}

function writePrefWeb(pref: UserThemePreference) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(USER_PREF_KEY, pref);
}

async function readPrefNative(): Promise<UserThemePreference | null> {
  try {
    const v = await AsyncStorage.getItem(USER_PREF_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  return null;
}

async function writePrefNative(pref: UserThemePreference) {
  try { await AsyncStorage.setItem(USER_PREF_KEY, pref); } catch {}
}

// ── CSS vars ──────────────────────────────────────────────────────────────────

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

// ── Resolve effective mode ────────────────────────────────────────────────────

function resolveMode(
  pref: UserThemePreference,
  systemScheme: ColorSchemeName,
  adminDefault: AppThemeMode,
): AppThemeMode {
  if (pref === 'light') return 'light';
  if (pref === 'dark')  return 'dark';
  // system
  if (systemScheme === 'light') return 'light';
  if (systemScheme === 'dark')  return 'dark';
  return adminDefault;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [userPref, setUserPrefState] = useState<UserThemePreference>('system');
  const [adminDefault, setAdminDefault] = useState<AppThemeMode>('dark');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    () => Appearance.getColorScheme()
  );

  // Derive effective mode
  const mode = resolveMode(userPref, systemScheme, adminDefault);
  const C = mode === 'light' ? LightColors : DarkColors;

  // Apply CSS vars on mode change (web only, no-op on native)
  useEffect(() => {
    injectCSSVars(C);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load persisted user pref on mount
  useEffect(() => {
    if (Platform.OS === 'web') {
      const saved = readPrefWeb();
      if (saved) {
        setUserPrefState(saved);
        // Inject CSS vars immediately to prevent flash
        const initialMode = resolveMode(saved, Appearance.getColorScheme(), adminDefault);
        injectCSSVars(initialMode === 'light' ? LightColors : DarkColors);
      }
    } else {
      readPrefNative().then(saved => {
        if (saved) setUserPrefState(saved);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for OS theme changes (system mode)
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  // Fetch admin default from Supabase + realtime
  useEffect(() => {
    supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'customer_app_theme')
      .maybeSingle()
      .then(({ data }) => {
        const raw = data?.value ?? 'dark';
        setAdminDefault(raw === 'light' ? 'light' : 'dark');
      });

    const channel = supabase
      .channel('customer_app_theme_watch')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings', filter: 'key=eq.customer_app_theme' },
        (payload) => {
          const newVal = (payload.new as { value?: string })?.value;
          setAdminDefault(newVal === 'light' ? 'light' : 'dark');
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []);

  const setUserPref = useCallback((pref: UserThemePreference) => {
    setUserPrefState(pref);
    if (Platform.OS === 'web') {
      writePrefWeb(pref);
    } else {
      writePrefNative(pref);
    }
  }, []);

  const compat = mode === 'light' ? LIGHT_COMPAT : DARK_COMPAT;

  return (
    <ThemeContext.Provider value={{ mode, userPref, setUserPref, C, theme: compat }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useTheme() {
  return useContext(ThemeContext);
}

export function useAppColors() {
  return useContext(ThemeContext).C;
}

export function useThemeMode(): AppThemeMode {
  return useContext(ThemeContext).mode;
}
