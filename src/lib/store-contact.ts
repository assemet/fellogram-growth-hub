/**
 * Store contact details and links. Everything a merchant types is normalized here, and every link shown to a
 * customer is rebuilt from the normalized value (never from raw text), so a store can only ever link to a
 * phone number, a social profile or a plain http(s) page: no javascript:, data:, credentials in the URL or
 * look-alike hosts (facebook.com.evil.com).
 */
export const CONTACT_FIELDS = ["phone", "whatsapp", "address", "telegram", "instagram", "facebook", "tiktok", "website", "maps"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];
export type ContactInput = Partial<Record<ContactField, string | null | undefined>>;
export type ContactValues = Record<ContactField, string | null>;
export type ContactErrors = Partial<Record<ContactField, "invalid">>;

const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const clean = (value: unknown) => String(value ?? "").replace(INVISIBLE, "").trim();

function phoneDigits(raw: string): string {
  const stripped = raw.replace(/[\s\-.()\u00A0]/g, "");
  return stripped.startsWith("00") ? `+${stripped.slice(2)}` : stripped;
}

/** http(s) only, no credentials, a real host with a dot; a missing scheme is assumed to be https. */
function parseUrl(raw: string): URL | null {
  if (!raw || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw.replace(/^\/\//, "")}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null;
  const href = url.href.replace(/\/$/, "");
  return href.length <= 300 ? new URL(url.pathname === "/" && !url.search && !url.hash ? href : url.href) : null;
}

const hostIs = (url: URL, ...domains: string[]) => domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
const finalHref = (url: URL) => (url.pathname === "/" && !url.search && !url.hash ? url.origin : url.href);
const firstSegment = (url: URL) => url.pathname.split("/").filter(Boolean)[0] ?? "";

type Result = string | null | "ERR";

function phone(raw: string): Result {
  const value = phoneDigits(raw);
  return /^\+?[0-9]{6,15}$/.test(value) ? value : "ERR";
}

function whatsapp(raw: string): Result {
  const value = phoneDigits(raw);
  return /^\+[1-9][0-9]{6,14}$/.test(value) ? value : "ERR";
}

function address(raw: string): Result {
  const value = raw.replace(/\s+/g, " ");
  return value.length <= 160 ? value : "ERR";
}

/** A handle typed as "@name", "name" or a profile link on one of the given hosts. */
function handle(raw: string, hosts: string[], pattern: RegExp, fromPath: (segment: string) => string): Result {
  let candidate = raw;
  if (/[/.]/.test(raw) && hosts.some((host) => raw.toLowerCase().includes(host))) {
    const url = parseUrl(raw);
    if (!url || !hostIs(url, ...hosts)) return "ERR";
    candidate = fromPath(firstSegment(url));
  }
  candidate = candidate.replace(/^@/, "");
  return pattern.test(candidate) ? candidate : "ERR";
}

const telegram = (raw: string): Result => handle(raw, ["t.me", "telegram.me"], /^[A-Za-z][A-Za-z0-9_]{4,31}$/, (segment) => segment);
const instagram = (raw: string): Result => handle(raw, ["instagram.com", "instagr.am"], /^[A-Za-z0-9._]{1,30}$/, (segment) => segment);
const tiktok = (raw: string): Result => handle(raw, ["tiktok.com"], /^[A-Za-z0-9._]{2,24}$/, (segment) => segment);

function facebook(raw: string): Result {
  if (!/[/]/.test(raw) && !/^https?:/i.test(raw) && !/(facebook|fb)\.(com|me)/i.test(raw)) {
    return /^[A-Za-z0-9.]{5,50}$/.test(raw) ? `https://facebook.com/${raw}` : "ERR";
  }
  const url = parseUrl(raw);
  return url && hostIs(url, "facebook.com", "fb.com", "fb.me") ? finalHref(url) : "ERR";
}

function website(raw: string): Result {
  const url = parseUrl(raw);
  return url ? finalHref(url) : "ERR";
}

const MAP_HOSTS = ["maps.google.com", "maps.app.goo.gl", "goo.gl", "waze.com", "maps.apple.com", "openstreetmap.org"];
function maps(raw: string): Result {
  const url = parseUrl(raw);
  if (!url) return "ERR";
  // Real Google domains only: google.com, google.com.ly, google.co.uk, google.ly ... never google.com.evil.com.
  const googleMaps = /^(www\.|maps\.)?google\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$/.test(url.hostname) && url.pathname.startsWith("/maps");
  const shortGoogle = url.hostname === "goo.gl" ? url.pathname.startsWith("/maps") : true;
  return (googleMaps || (hostIs(url, ...MAP_HOSTS) && shortGoogle)) ? finalHref(url) : "ERR";
}

const NORMALIZERS: Record<ContactField, (raw: string) => Result> = { phone, whatsapp, address, telegram, instagram, facebook, tiktok, website, maps };

/** Empty becomes null; anything invalid is reported per field and left out of `values`. */
export function normalizeContact(input: ContactInput): { values: ContactValues; errors: ContactErrors } {
  const values = Object.fromEntries(CONTACT_FIELDS.map((field) => [field, null])) as ContactValues;
  const errors: ContactErrors = {};
  for (const field of CONTACT_FIELDS) {
    const raw = clean(input[field]);
    if (!raw) continue;
    const result = NORMALIZERS[field](raw);
    if (result === "ERR") errors[field] = "invalid";
    else values[field] = result;
  }
  return { values, errors };
}

export type ContactLinkKind = "call" | "whatsapp" | "telegram" | "instagram" | "facebook" | "tiktok" | "website" | "maps";
export type ContactLink = { kind: ContactLinkKind; href: string };

/** The buttons a customer sees. Rebuilt from re-validated values, so a bad row in the database can never become a bad link. */
export function contactLinks(stored: ContactInput): ContactLink[] {
  const { values: v } = normalizeContact(stored);
  const links: ContactLink[] = [];
  if (v.phone) links.push({ kind: "call", href: `tel:${v.phone}` });
  if (v.whatsapp) links.push({ kind: "whatsapp", href: `https://wa.me/${v.whatsapp.slice(1)}` });
  if (v.telegram) links.push({ kind: "telegram", href: `https://t.me/${v.telegram}` });
  if (v.instagram) links.push({ kind: "instagram", href: `https://www.instagram.com/${v.instagram}` });
  if (v.facebook) links.push({ kind: "facebook", href: v.facebook });
  if (v.tiktok) links.push({ kind: "tiktok", href: `https://www.tiktok.com/@${v.tiktok}` });
  if (v.website) links.push({ kind: "website", href: v.website });
  if (v.maps) links.push({ kind: "maps", href: v.maps });
  return links;
}

/** Column names in the `stores` table for each field. */
export const CONTACT_COLUMNS: Record<ContactField, string> = {
  phone: "phone",
  whatsapp: "whatsapp",
  address: "address",
  telegram: "telegram_username",
  instagram: "instagram",
  facebook: "facebook_url",
  tiktok: "tiktok",
  website: "website_url",
  maps: "maps_url",
};

/** A `stores` row (any shape) → the contact fields the app uses. */
export function contactFromRow(row: Record<string, unknown> | null | undefined): ContactValues {
  const out = Object.fromEntries(CONTACT_FIELDS.map((field) => [field, null])) as ContactValues;
  if (!row) return out;
  for (const field of CONTACT_FIELDS) {
    const value = row[CONTACT_COLUMNS[field]];
    out[field] = typeof value === "string" && value.trim() ? value : null;
  }
  return out;
}
