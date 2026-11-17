/**
 * Someone can run their own store and also be a cashier for another one. This remembers which store the cashier
 * screen works on. It travels with every request as a header; the server only honours it when the person really
 * belongs to that store, otherwise it falls back to their own store.
 */
export const CASHIER_STORE_HEADER = "x-cashier-store";
const KEY = "fellogram.cashierStore";

export function getCashierStoreChoice(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setCashierStoreChoice(storeId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (storeId) window.localStorage.setItem(KEY, storeId);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable; the app then simply uses the default store.
  }
}

/**
 * Pinning: a cashier at several stores can lock this device to one of them. While pinned the app never asks which
 * store they are working at. The pin lives only on this device; the server still checks membership on every request.
 */
const PIN_KEY = "fellogram.cashierPinned";
const CONFIRMED_KEY = "fellogram.cashierConfirmed";

export function getCashierPinned(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PIN_KEY);
  } catch {
    return null;
  }
}

export function setCashierPinned(storeId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (storeId) window.localStorage.setItem(PIN_KEY, storeId);
    else window.localStorage.removeItem(PIN_KEY);
  } catch {
    // Storage can be unavailable; the app then asks every time.
  }
}

/** Whether the cashier already answered "which store are you at?" since this app launch (session storage). */
export function cashierConfirmedThisLaunch(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(CONFIRMED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markCashierConfirmed(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CONFIRMED_KEY, "1");
  } catch {
    // Without session storage the app just asks again next time.
  }
}
