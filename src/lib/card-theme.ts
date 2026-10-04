export const cardThemes = ["classic", "coffee", "purple", "emerald", "midnight", "electric", "sunset"] as const;
export type CardTheme = (typeof cardThemes)[number];

export function resolveCardTheme(value: string | null | undefined): CardTheme {
  return cardThemes.find((theme) => theme === value) ?? "classic";
}