/**
 * The optional line a store adds under the "reward collected" message ("See you next time!").
 * It is sent to customers straight from the store, so it is plain text only: one line, at most 120 characters,
 * and no links, handles or addresses (a store must not use this line to advertise or to send customers elsewhere).
 */
export const REDEEM_NOTE_MAX = 120;

const INVISIBLE = /[​-‏‪-‮⁠﻿]/g;
// Anything that Telegram would turn into a link, a mention or a command, or that looks like a web address.
const LINKISH = /(:\/\/|www\.|@|(^|\s)\/[a-z]|\b(t|wa)\.me\b|[\p{L}\p{N}-]+\.(com|net|org|info|biz|io|me|app|co|ly|ru|uk|us|tr|es|id|uz|ua|xyz|site|online|shop|store)\b)/iu;

/** Empty → null. A note that is too long or contains a link-like part is reported as "ERR" and is never stored. */
export function normalizeRedeemNote(input: unknown): string | null | "ERR" {
  const value = String(input ?? "").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
  if (!value) return null;
  if ([...value].length > REDEEM_NOTE_MAX) return "ERR";
  if (LINKISH.test(value)) return "ERR";
  return value;
}

/** Re-checked on every send, so a bad row in the database can never reach a customer. */
export function redeemNoteFromRow(row: Record<string, unknown> | null | undefined): string | null {
  const value = row?.["redeem_note"];
  if (typeof value !== "string") return null;
  const note = normalizeRedeemNote(value);
  return note === "ERR" ? null : note;
}
