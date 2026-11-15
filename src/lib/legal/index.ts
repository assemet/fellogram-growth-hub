import type { Locale } from "@/lib/i18n";

import { ar } from "./ar";
import { en } from "./en";
import { es } from "./es";
import { ru } from "./ru";
import { tr } from "./tr";
import type { LegalContent } from "./types";

export { LEGAL_UPDATED } from "./types";
export type { LegalContent, LegalDoc, LegalSection } from "./types";

const CONTENT: Record<Locale, LegalContent> = { ar, en, es, ru, tr };

/** The legal texts in the person's language. */
export function legalContent(locale: Locale): LegalContent {
  return CONTENT[locale] ?? en;
}
