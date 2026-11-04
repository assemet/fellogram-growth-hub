/** The app's top-level destinations and which of them a person may use. */
export type Tab = "wallet" | "cashier" | "merchant" | "settings";
export type Roles = { isOwner: boolean; isStaff: boolean };

export const TAB_PATH = { wallet: "/wallet", cashier: "/cashier", merchant: "/merchant", settings: "/settings" } as const satisfies Record<Tab, string>;

const STORAGE_KEY = "fellogram.lastTab";

/** Everyone has their cards; stamping needs a team role; the store dashboard needs ownership. */
export function tabsFor(roles: Roles): Tab[] {
  const tabs: Tab[] = ["wallet"];
  if (roles.isOwner || roles.isStaff) tabs.push("cashier");
  if (roles.isOwner) tabs.push("merchant");
  tabs.push("settings");
  return tabs;
}

/** First launch on a device: owners land on their store, employees at the counter, customers on their cards. */
export function defaultTab(roles: Roles): Tab {
  if (roles.isOwner) return "merchant";
  if (roles.isStaff) return "cashier";
  return "wallet";
}

/** Reopen the tab used last, as long as this person may still use it (e.g. after being removed from the team). */
export function pickStartTab(roles: Roles, last: string | null): Tab {
  // Settings is a place to visit, never a place to start from.
  return tabsFor(roles).find((tab) => tab !== "settings" && tab === last) ?? defaultTab(roles);
}

export function readLastTab(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberTab(tab: Tab): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    /* the default start tab is used next time */
  }
}
