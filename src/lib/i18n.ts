/**
 * Minimal i18n layer. All UI copy goes through `t()` so business logic never carries hardcoded strings.
 * To add a language: create src/lib/locales/<code>.ts (TypeScript requires every key), then add it to
 * LOCALES and `loaders` below. English is bundled with the app; every other language is its own small file that
 * is downloaded only when somebody uses it, so adding languages never makes the app heavier for everyone else.
 */
import { en, type TranslationKey } from "./locales/en";

export type { TranslationKey };

/** Supported languages, in the order shown in menus. Names are written in their own language on purpose. */
export const LOCALES = [
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "en", name: "English", dir: "ltr" },
  { code: "ru", name: "Русский", dir: "ltr" },
  { code: "es", name: "Español", dir: "ltr" },
  { code: "tr", name: "Türkçe", dir: "ltr" },
  { code: "uk", name: "Українська", dir: "ltr" },
  { code: "uz", name: "Oʻzbekcha", dir: "ltr" },
  { code: "id", name: "Bahasa Indonesia", dir: "ltr" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "fellogram.locale";

type Dictionary = Record<TranslationKey, string>;

const loaders: Record<Exclude<Locale, "en">, () => Promise<Dictionary>> = {
  ar: () => import("./locales/ar").then((module) => module.ar),
  ru: () => import("./locales/ru").then((module) => module.ru),
  es: () => import("./locales/es").then((module) => module.es),
  tr: () => import("./locales/tr").then((module) => module.tr),
  uk: () => import("./locales/uk").then((module) => module.uk),
  uz: () => import("./locales/uz").then((module) => module.uz),
  id: () => import("./locales/id").then((module) => module.id),
};

const loaded: Partial<Record<Locale, Dictionary>> = { en };

/** Downloads a language once. Resolves to null when it cannot be fetched (offline): callers keep what is on screen. */
async function loadDictionary(code: Locale): Promise<Dictionary | null> {
  const ready = loaded[code];
  if (ready) return ready;
  if (code === "en") return en;
  try {
    const dictionary = await loaders[code]();
    loaded[code] = dictionary;
    return dictionary;
  } catch {
    return null;
  }
}

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

let locale: Locale = detect();
let dictionary: Dictionary = en;

function applyDocumentLocale() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
  document.documentElement.dir = dirOf(locale);
}

// The language is downloaded before the app starts (top-level await), so the very first frame is already in the
// right language: nothing is ever drawn in a different language first. Offline, it falls back to English.
if (typeof window !== "undefined" && locale !== "en") {
  const first = await loadDictionary(locale);
  if (first) dictionary = first;
  else locale = "en";
}

applyDocumentLocale();

export function getLocale(): Locale {
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

let wanted: Locale = locale;

/**
 * Switches the language shown. The text stays in the current language until the new one is ready, so the screen
 * never shows a mix or a blank. Already downloaded languages switch at once.
 */
function show(next: Locale, notify: boolean) {
  wanted = next;
  const ready = loaded[next];
  const apply = (dictionaryOfNext: Dictionary) => {
    locale = next;
    dictionary = dictionaryOfNext;
    applyDocumentLocale();
    if (notify) localeListeners.forEach((listener) => listener());
  };
  if (ready) {
    apply(ready);
    return;
  }
  void loadDictionary(next).then((fetched) => {
    // Several switches in a row: only the latest one counts. A failed download keeps the current language.
    if (fetched && wanted === next) {
      apply(fetched);
      // Arrived after the app was already drawn, so the screens must update.
      if (!notify) localeListeners.forEach((listener) => listener());
    }
  });
}

export function initializeLocale(telegramLanguage?: string | null) {
  if (typeof window === "undefined") return locale;
  const next = detect(telegramLanguage);
  show(next, false);
  return next;
}

/** A person's choice: saved on this device and kept until they change it again. */
export function setLocale(next: Locale) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* storage can be blocked: the choice then lasts for this session only */
    }
  }
  show(next, true);
}

export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  const template = dictionary[key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
