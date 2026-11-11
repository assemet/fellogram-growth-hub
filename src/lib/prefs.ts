import { isWalletView, type WalletView } from "@/lib/wallet-view";

/** Device-level preferences (never sent to the server). */
export type Appearance = "auto" | "light" | "dark";
export type TextSize = "normal" | "large";
export type BoolPref = "sound" | "vibration" | "autoStamp";

const KEYS = {
  appearance: "fellogram.appearance",
  textSize: "fellogram.textSize",
  sound: "fellogram.sound",
  vibration: "fellogram.vibration",
  autoStamp: "fellogram.autoStamp",
  walletView: "fellogram.walletView",
} as const;

export const APPEARANCE_EVENT = "fellogram:appearance";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* the preference then lasts for this session only */
  }
}

export function readAppearance(): Appearance {
  if (typeof window === "undefined") return "auto";
  const value = read(KEYS.appearance);
  return value === "light" || value === "dark" ? value : "auto";
}

/** Saves the choice and tells the theme watcher (see watchTelegramTheme) to re-apply it. */
export function setAppearance(value: Appearance): void {
  write(KEYS.appearance, value);
  window.dispatchEvent(new Event(APPEARANCE_EVENT));
}

export function readTextSize(): TextSize {
  if (typeof window === "undefined") return "normal";
  return read(KEYS.textSize) === "large" ? "large" : "normal";
}

/** All sizes are rem-based, so scaling the root font size scales the whole interface. */
export function applyTextSize(size: TextSize): void {
  document.documentElement.style.fontSize = size === "large" ? "112.5%" : "";
}

export function setTextSize(size: TextSize): void {
  write(KEYS.textSize, size);
  applyTextSize(size);
}

/** Stored as "1"/"0"; anything else (including nothing) means the default, which is on. */
export function readBool(pref: BoolPref, fallback = true): boolean {
  if (typeof window === "undefined") return fallback;
  const value = read(KEYS[pref]);
  if (value === "0") return false;
  if (value === "1") return true;
  return fallback;
}

export function writeBool(pref: BoolPref, value: boolean): void {
  write(KEYS[pref], value ? "1" : "0");
}

/** null means "not chosen": the wallet then picks a layout from the number of cards. */
export function readWalletView(): WalletView | null {
  if (typeof window === "undefined") return null;
  const value = read(KEYS.walletView);
  return isWalletView(value) ? value : null;
}

export function writeWalletView(view: WalletView): void {
  write(KEYS.walletView, view);
}
