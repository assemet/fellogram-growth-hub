/**
 * Legal texts are kept apart from the interface strings so a lawyer can read and edit them as plain documents.
 * Every language must provide every part (TypeScript enforces it). Update LEGAL_UPDATED when any text changes.
 */
/**
 * "lead" is a line that introduces the bullets and is shown before them. "paragraphs" are shown after the bullets
 * when there are any, otherwise on their own.
 */
export type LegalSection = { heading: string; lead?: string; paragraphs?: string[]; bullets?: string[] };

export type LegalDoc = {
  title: string;
  intro: string;
  sections: LegalSection[];
  /** The closing "Contact" part. "{email}" is replaced by the support address; without one, the second text is used. */
  contact: { heading: string; withEmail: string; withoutEmail: string };
};

export type LegalContent = {
  updated: string;
  agreeStore: string;
  privacy: LegalDoc;
  terms: LegalDoc;
};

/** ISO date of the last change to any legal text. */
export const LEGAL_UPDATED = "2026-11-15";
