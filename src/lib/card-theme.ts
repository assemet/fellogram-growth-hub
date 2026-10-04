import type { CSSProperties } from "react";

export const cardThemes = ["classic", "coffee", "purple", "emerald", "midnight", "electric", "sunset"] as const;
export type CardTheme = (typeof cardThemes)[number];

export function resolveCardTheme(value: string | null | undefined): CardTheme {
  return cardThemes.find((theme) => theme === value) ?? "classic";
}

export type BrandColors = { brandPrimary?: string | null; brandAccent?: string | null; backgroundTint?: string | null };

export const brandPalettes: Record<CardTheme, { primary: string; accent: string; tint: string }> = {
  classic: { primary: "#6941a4", accent: "#227f77", tint: "#f5f6f8" },
  coffee: { primary: "#67432f", accent: "#a87845", tint: "#f7f1e9" },
  purple: { primary: "#63378c", accent: "#9655b5", tint: "#f6f0fa" },
  emerald: { primary: "#146b54", accent: "#328e74", tint: "#edf7f1" },
  midnight: { primary: "#1c2a45", accent: "#42dcc0", tint: "#161f31" },
  electric: { primary: "#2556ae", accent: "#417ddc", tint: "#eef4fc" },
  sunset: { primary: "#a7502b", accent: "#dc963e", tint: "#fff3e7" },
};

export const isHexColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

function brightness(hex: string) {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722;
}

function mixHex(hex: string, target: "#000000" | "#ffffff", amount: number) {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const targetChannel = target === "#ffffff" ? 255 : 0;
  return `#${channels.map((channel) => Math.round(channel + (targetChannel - channel) * amount).toString(16).padStart(2, "0")).join("")}`;
}

function contrastRatio(first: string, second: string) {
  const bright = brightness(first);
  const dark = brightness(second);
  return (Math.max(bright, dark) + 0.05) / (Math.min(bright, dark) + 0.05);
}

/** Preserve the merchant hue while moving action colors to a guaranteed AAA text contrast. */
function accessibleActionColor(hex: string) {
  const candidates = Array.from({ length: 11 }, (_, index) => index / 10).flatMap((amount) => [mixHex(hex, "#000000", amount), mixHex(hex, "#ffffff", amount)]);
  return candidates.find((candidate) => Math.max(contrastRatio(candidate, "#000000"), contrastRatio(candidate, "#ffffff")) >= 7) ?? "#182126";
}

/** Runtime values are validated hex colors; preset and custom colors share the same semantic tokens. */
export function brandThemeStyle(theme: string | null | undefined, colors: BrandColors = {}) {
  const preset = brandPalettes[resolveCardTheme(theme)];
  const primary = isHexColor(colors.brandPrimary) ? colors.brandPrimary : preset.primary;
  const accent = isHexColor(colors.brandAccent) ? colors.brandAccent : preset.accent;
  const tint = isHexColor(colors.backgroundTint) ? colors.backgroundTint : preset.tint;
  const dark = brightness(tint) < 0.28;
  const action = accessibleActionColor(primary);
  const onAction = contrastRatio(action, "#000000") >= 7 ? "#000000" : "#ffffff";
  return {
    "--store-primary": primary,
    "--store-accent": accent,
    "--store-tint": tint,
    "--store-ink": dark ? "#f8fafc" : "#20242b",
    "--store-on-primary": brightness(primary) > 0.36 ? "#151b22" : "#ffffff",
    "--store-on-accent": brightness(accent) > 0.36 ? "#151b22" : "#ffffff",
    "--store-action": action,
    "--store-on-action": onAction,
    "--store-surface": dark ? "#202c40" : "#ffffff",
    "--store-muted-ink": dark ? "#c2cbd8" : "#53616b",
  } as CSSProperties;
}