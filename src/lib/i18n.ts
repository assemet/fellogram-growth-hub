/**
 * Minimal i18n layer. All UI copy goes through `t()` so business logic never carries hardcoded strings.
 * To add a language: create src/lib/locales/<code>.ts (TypeScript requires every key), then add it to
 * LOCALES and `dictionaries` below.
 */
import { ar } from "./locales/ar";
import { en, type TranslationKey } from "./locales/en";
import { es } from "./locales/es";
import { ru } from "./locales/ru";
import { tr } from "./locales/tr";

export type { TranslationKey };

/** Supported languages, in the order shown in menus. Names are written in their own language on purpose. */
export const LOCALES = [
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "en", name: "English", dir: "ltr" },
  { code: "ru", name: "Русский", dir: "ltr" },
  { code: "es", name: "Español", dir: "ltr" },
  { code: "tr", name: "Türkçe", dir: "ltr" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "fellogram.locale";

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, ar, ru, es, tr };

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale.code === value);
}

/** "ru-RU", "es_MX" or "TR" → "ru" | "es" | "tr"; a language we do not offer → null. */
export function matchLocale(tag: string | null | undefined): Locale | null {
  const primary = String(tag ?? "").trim().toLowerCase().replace("_", "-").split("-")[0];
  return isLocale(primary) ? primary : null;
}

/** The first language we offer among the candidates (in priority order); English when none is offered. */
export function resolveLocale(candidates: (string | null | undefined)[]): Locale {
  for (const candidate of candidates) {
    const match = matchLocale(candidate);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

export function dirOf(code: Locale): "rtl" | "ltr" {
  return LOCALES.find((locale) => locale.code === code)?.dir ?? "ltr";
}

function storedLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null; // storage can be blocked: fall through to detection
  }
}

function deviceLanguages(): string[] {
  const languages = window.navigator.languages;
  return languages && languages.length > 0 ? [...languages] : [window.navigator.language];
}

type TelegramWindow = { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } } };

/**
 * Order of preference: the language the person picked in the app (kept until they change it), then their
 * Telegram language, then the device languages, then English.
 */
function detect(telegramLanguage?: string | null): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const chosen = storedLocale();
  if (chosen) return chosen;
  const telegram = telegramLanguage ?? (window as unknown as TelegramWindow).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  return resolveLocale([telegram, ...deviceLanguages()]);
}

/** Resolved synchronously at load so the very first frame is already in the right language. */
let locale: Locale = detect();

function applyDocumentLocale() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = dirOf(locale);
}

applyDocumentLocale();

export function getLocale(): Locale {
  return locale;
}

export function initializeLocale(telegramLanguage?: string | null) {
  if (typeof window === "undefined") return locale;
  locale = detect(telegramLanguage);
  applyDocumentLocale();
  return locale;
}

const localeListeners = new Set<() => void>();

/** Lets React re-render the whole UI when the language changes (see useLocale). */
export function subscribeLocale(listener: () => void) {
  localeListeners.add(listener);
  return () => {
    localeListeners.delete(listener);
  };
}

/** A person's choice: saved on this device and kept until they change it again. */
export function setLocale(next: Locale) {
  locale = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* storage can be blocked: the choice then lasts for this session only */
    }
  }
  applyDocumentLocale();
  localeListeners.forEach((listener) => listener());
}

export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[locale][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
