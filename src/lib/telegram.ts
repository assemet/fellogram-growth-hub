/**
 * Browser-side Telegram Mini App helpers. The raw initData string is only ever
 * forwarded to the server, which validates it with HMAC before trusting it.
 */

type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: { start_param?: string };
  ready?: () => void;
  expand?: () => void;
  colorScheme?: "light" | "dark";
  onEvent?: (event: string, callback: () => void) => void;
  offEvent?: (event: string, callback: () => void) => void;
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
    document.documentElement.classList.toggle("telegram-theme", Boolean(app));
  };
  sync();
  app?.onEvent?.("themeChanged", sync);
  media.addEventListener("change", sync);
  return () => {
    app?.offEvent?.("themeChanged", sync);
    media.removeEventListener("change", sync);
  };
}

export function getInitData(): string {
  return webApp()?.initData ?? "";
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
