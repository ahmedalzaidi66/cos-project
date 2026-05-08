import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { I18nManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, Translations, translations, LANGUAGES } from '@/constants/i18n';

const STORAGE_KEY = 'app_language';
const VALID_LANGUAGES = ['en', 'ar', 'es', 'de', 'ru', 'ckb'];

type LanguageContextType = {
  language: Language;
  t: Translations;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getStoredLanguage(): Language {
  if (Platform.OS === 'web') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_LANGUAGES.includes(stored)) {
        return stored as Language;
      }
    } catch {}
  }
  return 'en';
}

async function loadStoredLanguageMobile(): Promise<Language> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && VALID_LANGUAGES.includes(stored)) {
      return stored as Language;
    }
  } catch {}
  return 'en';
}

function storeLanguage(lang: Language) {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  } else {
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  }
}

/**
 * Wraps a translations object with a Proxy that falls back to English for any missing key.
 * This ensures no UI text is ever undefined/empty regardless of translation completeness.
 */
function withFallback(target: Record<string, any>, fallback: Record<string, any>): Translations {
  if (typeof Proxy === 'undefined') {
    // Environments without Proxy — merge objects (English wins only for missing keys)
    const merged: Record<string, any> = { ...fallback };
    for (const key of Object.keys(target)) {
      if (target[key] !== undefined && target[key] !== null && target[key] !== '') {
        merged[key] = target[key];
      }
    }
    return merged as Translations;
  }

  return new Proxy(target, {
    get(obj, prop: string) {
      const val = obj[prop];
      if (val !== undefined && val !== null && val !== '') return val;
      const fb = fallback[prop];
      if (fb !== undefined && fb !== null && fb !== '') return fb;
      // Final safety net: return prop name as readable placeholder
      return typeof prop === 'string' ? prop : '';
    },
  }) as unknown as Translations;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [ready, setReady] = useState(Platform.OS === 'web');

  useEffect(() => {
    if (Platform.OS === 'web') {
      setLanguageState(getStoredLanguage());
      setReady(true);
    } else {
      loadStoredLanguageMobile().then((stored) => {
        setLanguageState(stored);
        setReady(true);
      });
    }
  }, []);

  const isRTL = LANGUAGES.find((l) => l.code === language)?.rtl ?? false;

  useEffect(() => {
    if (Platform.OS !== 'web') {
      const shouldBeRTL = isRTL;
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.forceRTL(shouldBeRTL);
      }
    }
  }, [isRTL]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    storeLanguage(lang);
    if (Platform.OS !== 'web') {
      const rtl = LANGUAGES.find((l) => l.code === lang)?.rtl ?? false;
      if (I18nManager.isRTL !== rtl) {
        I18nManager.forceRTL(rtl);
      }
    }
  }, []);

  const t = useMemo(() => {
    const base = translations[language] as Record<string, any>;
    const en = translations['en'] as Record<string, any>;
    if (language === 'en') return base as Translations;
    return withFallback(base, en);
  }, [language]);

  if (!ready) return null;

  return (
    <LanguageContext.Provider value={{ language, t, setLanguage, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
