/**
 * Browser-side Telegram Mini App helpers. The raw initData string is only ever
 * forwarded to the server, which validates it with HMAC before trusting it.
 */

type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: { start_param?: string };
  ready?: () => void;
  expand?: () => void;
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
