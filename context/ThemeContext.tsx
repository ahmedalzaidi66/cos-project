import React, { createContext, useContext, useEffect } from 'react';
import { Platform } from 'react-native';

export const DEFAULT_THEME = {
  primary:    '#FF4D8D',
  background: '#0A0507',
  text:       '#FDE8F0',
  accent:     '#FF4D8D',
};

type ThemeContextType = {
  theme: typeof DEFAULT_THEME;
};

const ThemeContext = createContext<ThemeContextType>({ theme: DEFAULT_THEME });

function injectCSSVars() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--primary',          DEFAULT_THEME.primary);
  root.style.setProperty('--bg',               DEFAULT_THEME.background);
  root.style.setProperty('--text',             DEFAULT_THEME.text);
  root.style.setProperty('--accent',           DEFAULT_THEME.accent);
  root.style.setProperty('--primary-color',    DEFAULT_THEME.primary);
  root.style.setProperty('--background-color', DEFAULT_THEME.background);
  root.style.setProperty('--text-primary',     DEFAULT_THEME.text);
  root.style.setProperty('--accent-color',     DEFAULT_THEME.accent);
  document.body.style.backgroundColor = DEFAULT_THEME.background;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    injectCSSVars();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: DEFAULT_THEME }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
