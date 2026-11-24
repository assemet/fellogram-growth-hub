/**
 * A store owner's referral link opens the app with `mref_<storeId>`. The id is kept here until the new owner
 * creates a store, then sent along with it. It is only a pointer: the server checks the store exists.
 */
const KEY = "fellogram.merchantRef";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function rememberMerchantRef(startParam: string): boolean {
  const id = startParam.replace(/^mref_/, "").toLowerCase();
  if (!UUID.test(id) || typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    return false;
  }
  return true;
}

export function readMerchantRef(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(KEY);
    return value && UUID.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearMerchantRef() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
