import en from './en';
import ar from './ar';
import es from './es';
import de from './de';
import ru from './ru';
import ckb from './ckb';

export type Language = 'en' | 'ar' | 'es' | 'de' | 'ru' | 'ckb';
export type Translations = typeof en;

export const translations: Record<Language, any> = { en, ar, es, de, ru, ckb };

export const LANGUAGES: { code: Language; label: string; nativeLabel: string; rtl: boolean }[] = [
  { code: 'en',  label: 'English',  nativeLabel: 'English',   rtl: false },
  { code: 'ar',  label: 'Arabic',   nativeLabel: 'العربية',   rtl: true  },
  { code: 'es',  label: 'Spanish',  nativeLabel: 'Español',   rtl: false },
  { code: 'de',  label: 'German',   nativeLabel: 'Deutsch',   rtl: false },
  { code: 'ru',  label: 'Russian',  nativeLabel: 'Русский',   rtl: false },
  { code: 'ckb', label: 'Kurdish',  nativeLabel: 'کوردی',     rtl: true  },
];

export { en, ar, es, de, ru, ckb };
