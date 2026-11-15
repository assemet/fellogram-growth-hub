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
