/**
 * Stamp icon library: ids and categories only (no UI imports), shared by the
 * client picker and server-side validation. Components live in StampIcon.tsx.
 * Ids must stay lowercase kebab-case: the database only checks that shape.
 */
export const STAMP_LOGO_ID = "logo";

export const stampIconCategories = [
  { id: "general", icons: ["stamp", "star", "crown", "award", "zap", "flame", "music", "book", "camera", "ticket"] },
  { id: "food", icons: ["coffee", "croissant", "pizza", "sandwich", "ice-cream", "cake", "cookie", "food", "soup", "salad", "drumstick", "fish", "glass-water", "milk", "cup-soda", "candy", "apple"] },
  { id: "beauty", icons: ["scissors", "sparkles", "heart", "flower", "droplets", "bath", "smile", "brush"] },
  { id: "shop", icons: ["gift", "shopping-bag", "shirt", "gem", "tag", "store", "glasses", "watch"] },
  { id: "auto", icons: ["car", "wrench", "fuel", "bike"] },
  { id: "pets", icons: ["paw-print", "dog", "cat", "leaf", "tree"] },
  { id: "health", icons: ["dumbbell", "pill", "stethoscope", "heart-pulse"] },
] as const;

export type StampIconCategoryId = (typeof stampIconCategories)[number]["id"];
export type StampIconId = (typeof stampIconCategories)[number]["icons"][number];

export const stampIconIds: readonly StampIconId[] = stampIconCategories.flatMap((category) => category.icons);

export function isStampIconId(value: unknown): value is StampIconId {
  return typeof value === "string" && (stampIconIds as readonly string[]).includes(value);
}

export function categoryOfIcon(value: string): StampIconCategoryId {
  return stampIconCategories.find((category) => (category.icons as readonly string[]).includes(value))?.id ?? "general";
}
