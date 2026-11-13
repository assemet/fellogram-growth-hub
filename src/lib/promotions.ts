/** Shared helpers for stamp events and offers (no server code, safe for the browser). */

export type PromoWindow = { startsAt: string; endsAt: string };

export type PromoStatus = "live" | "soon" | "ended";

export function promoStatus(promo: PromoWindow & { active: boolean }, now = Date.now()): PromoStatus {
  if (!promo.active) return "ended";
  if (new Date(promo.endsAt).getTime() <= now) return "ended";
  if (new Date(promo.startsAt).getTime() > now) return "soon";
  return "live";
}

/** Switched off by the owner while time was still left (as opposed to simply running out). */
export function wasStopped(promo: PromoWindow & { active: boolean }, now = Date.now()): boolean {
  return !promo.active && new Date(promo.endsAt).getTime() > now;
}

const MAX_WINDOW_MS = 366 * 24 * 60 * 60 * 1000;

/** Same rule the database enforces: end after start, at most a year long. Returns normalized ISO strings. */
export function parseWindow(startsAt: unknown, endsAt: unknown): PromoWindow {
  const start = new Date(String(startsAt ?? ""));
  const end = new Date(String(endsAt ?? ""));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("INVALID_DATES");
  if (end.getTime() <= start.getTime() || end.getTime() - start.getTime() > MAX_WINDOW_MS) throw new Error("INVALID_DATES");
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

/** Value for an <input type="datetime-local"> in the device's own time zone. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Scanned offer QR payload (fellogram:o:<token>) → token. */
export function parseOfferCode(raw: string): string | null {
  const value = String(raw ?? "").trim();
  if (!/^fellogram:o:/i.test(value)) return null;
  const token = value.slice("fellogram:o:".length);
  return /^[0-9a-f]{48}$/i.test(token) ? token.toLowerCase() : null;
}
