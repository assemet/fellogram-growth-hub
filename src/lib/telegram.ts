/**
 * Browser-side Telegram Mini App helpers. The raw initData string is only ever
 * forwarded to the server, which validates it with HMAC before trusting it.
 */

type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: { start_param?: string; user?: { language_code?: string } };
  ready?: () => void;
  expand?: () => void;
  colorScheme?: "light" | "dark";
  onEvent?: (event: string, callback: () => void) => void;
  offEvent?: (event: string, callback: () => void) => void;
  openTelegramLink?: (url: string) => void;
  showScanQrPopup?: (params: { text?: string }, callback?: (text: string) => boolean | void) => void;
  closeScanQrPopup?: () => void;
};

function webApp(): TelegramWebApp | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

export function initTelegram() {
  const app = webApp();
  app?.ready?.();
  app?.expand?.();
}

/** Keep the app in sync with Telegram's live appearance, or the device preference outside Telegram. */
export function watchTelegramTheme() {
  if (typeof window === "undefined") return () => {};
  const app = webApp();
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = () => {
    document.documentElement.classList.toggle("dark", app?.colorScheme === "dark" || (!app?.colorScheme && media.matches));
    document.documentElement.classList.toggle("telegram-theme", Boolean(app && getComputedStyle(document.documentElement).getPropertyValue("--tg-theme-bg-color").trim()));
  };
  sync();
  app?.onEvent?.("themeChanged", sync);
  media.addEventListener("change", sync);
  return () => {
    app?.offEvent?.("themeChanged", sync);
    media.removeEventListener("change", sync);
  };
}

const INIT_DATA_KEY = "fellogram.tgInitData";

/** Signed launch data: from the WebApp SDK, or Telegram's launch URL hash as a fallback. */
export function getInitData(): string {
  const fromApp = webApp()?.initData;
  if (fromApp) return fromApp;
  if (typeof window === "undefined") return "";
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("tgWebAppData");
  if (fromHash) {
    window.sessionStorage.setItem(INIT_DATA_KEY, fromHash);
    return fromHash;
  }
  return window.sessionStorage.getItem(INIT_DATA_KEY) ?? "";
}

/** Unverified Telegram user id — only used to detect a stale session, never for identity. */
export function getUnsafeTelegramUserId(): number | null {
  const fromApp = (webApp()?.initDataUnsafe?.user as { id?: number } | undefined)?.id;
  if (typeof fromApp === "number") return fromApp;
  const raw = getInitData();
  if (!raw) return null;
  try {
    const user = JSON.parse(new URLSearchParams(raw).get("user") ?? "null") as { id?: number } | null;
    return typeof user?.id === "number" ? user.id : null;
  } catch {
    return null;
  }
}

export function getTelegramLanguage(): string | null {
  return webApp()?.initDataUnsafe?.user?.language_code ?? null;
}

/** Deep-link payload: staff invite code, store join code or referral code. */
export function getStartParam(): string | null {
  const fromTelegram = webApp()?.initDataUnsafe?.start_param;
  if (fromTelegram) return fromTelegram;
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("startapp") ?? params.get("start") ?? null;
}

const PENDING_KEY = "fellogram.pendingStartParam";

export function rememberStartParam() {
  const value = getStartParam();
  if (value && typeof window !== "undefined") {
    window.localStorage.setItem(PENDING_KEY, value);
  }
}

export function readPendingStartParam(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PENDING_KEY);
}

export function clearPendingStartParam() {
  if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_KEY);
}

/** Opens Telegram's share sheet for a link, falling back to a new tab outside Telegram. */
export function shareViaTelegram(link: string, text: string) {
  const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  const app = webApp();
  if (app?.openTelegramLink) app.openTelegramLink(url);
  else if (typeof window !== "undefined") window.open(url, "_blank", "noopener");
}

/**
 * Telegram's built-in QR scanner. Returns false when unavailable (older clients, plain browser).
 * `onText` returns true to close the scanner, false to keep scanning.
 */
export function openTelegramQrScanner(promptText: string, onText: (text: string) => boolean): boolean {
  const app = webApp();
  if (!app?.showScanQrPopup) return false;
  try {
    app.showScanQrPopup({ text: promptText }, (text) => {
      const done = onText(text);
      if (done) app.closeScanQrPopup?.();
      return done;
    });
    return true;
  } catch {
    return false;
  }
}
