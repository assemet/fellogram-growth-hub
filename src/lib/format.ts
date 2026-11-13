import { getLocale } from "@/lib/i18n";

/** The app language for Intl. Arabic keeps Western digits, like every other number in the interface. */
function intlLocale(): string {
  const locale = getLocale();
  return locale === "ar" ? "ar-u-nu-latn" : locale;
}

/** "3 days ago" / "منذ 3 أيام" in the app language. */
export function formatRelative(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffSeconds = Math.round((then - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(intlLocale(), { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, seconds] of steps) {
    if (Math.abs(diffSeconds) >= seconds) return formatter.format(Math.round(diffSeconds / seconds), unit);
  }
  return formatter.format(0, "second");
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(), { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** "12 Nov, 11:35" in the app language: date and time together, for promotion windows. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(), { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

/** "18 Nov" / "١٨ نوفمبر" style: day and month only, in the app language. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(), { day: "numeric", month: "short" }).format(date);
}
