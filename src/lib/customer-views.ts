/** How the owner slices the customer list: filters, sort orders and the CSV/TSV export. Pure, so it is testable. */
export type CustomerRow = {
  customerId: string;
  name: string | null;
  username: string | null;
  balance: number;
  required: number;
  joinedAt: string;
  lastVisitAt: string | null;
};

export const FILTERS = ["all", "ready", "close", "inactive", "new"] as const;
export const SORTS = ["recent", "closest", "stamps", "newest", "name"] as const;
export type Filter = (typeof FILTERS)[number];
export type Sort = (typeof SORTS)[number];

export const INACTIVE_DAYS = 30;
export const NEW_DAYS = 7;
/** "Close to reward" means one or two stamps short. */
export const CLOSE_WITHIN = 2;

export const isFilter = (value: unknown): value is Filter => typeof value === "string" && (FILTERS as readonly string[]).includes(value);
export const isSort = (value: unknown): value is Sort => typeof value === "string" && (SORTS as readonly string[]).includes(value);

const DAY = 864e5;
const time = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

export function matchesFilter(row: CustomerRow, filter: Filter, now = Date.now()): boolean {
  switch (filter) {
    case "all":
      return true;
    case "ready":
      return row.balance >= row.required;
    case "close":
      return row.balance < row.required && row.required - row.balance <= CLOSE_WITHIN;
    case "inactive":
      return time(row.lastVisitAt ?? row.joinedAt) < now - INACTIVE_DAYS * DAY;
    case "new":
      return time(row.joinedAt) >= now - NEW_DAYS * DAY;
  }
}

export function filterCounts(rows: CustomerRow[], now = Date.now()): Record<Filter, number> {
  const counts = { all: 0, ready: 0, close: 0, inactive: 0, new: 0 } satisfies Record<Filter, number>;
  for (const row of rows) for (const filter of FILTERS) if (matchesFilter(row, filter, now)) counts[filter] += 1;
  return counts;
}

const progress = (row: CustomerRow) => row.balance / Math.max(1, row.required);
const label = (row: CustomerRow) => (row.name ?? row.username ?? "").toLowerCase();

/** Returns a new array; ties keep a stable, predictable order (most recent visit first). */
export function sortRows(rows: CustomerRow[], sort: Sort): CustomerRow[] {
  const byRecent = (a: CustomerRow, b: CustomerRow) => time(b.lastVisitAt ?? b.joinedAt) - time(a.lastVisitAt ?? a.joinedAt);
  const compare: Record<Sort, (a: CustomerRow, b: CustomerRow) => number> = {
    recent: byRecent,
    // Customers who already have their reward come first, then the nearest to it.
    closest: (a, b) => progress(b) - progress(a) || byRecent(a, b),
    stamps: (a, b) => b.balance - a.balance || byRecent(a, b),
    newest: (a, b) => time(b.joinedAt) - time(a.joinedAt),
    name: (a, b) => {
      // Customers without any name sort last instead of first.
      if (!label(a) !== !label(b)) return label(a) ? -1 : 1;
      return label(a).localeCompare(label(b)) || byRecent(a, b);
    },
  };
  return [...rows].sort(compare[sort]);
}

/**
 * A spreadsheet runs a cell that starts with = + - @ as a formula, and a customer controls their own
 * name. Prefixing an apostrophe keeps it plain text.
 */
function guard(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function csvCell(value: string | number): string {
  const text = guard(String(value));
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Tab-separated cells paste straight into Google Sheets / Excel columns. */
export function tsvCell(value: string | number): string {
  return guard(String(value)).replace(/[\t\r\n]+/g, " ");
}

export type Locale2 = "ar" | "en";

const HEADERS: Record<Locale2, string[]> = {
  en: ["Name", "Username", "Stamps", "Stamps needed", "Reward ready", "Last visit", "Joined"],
  ar: ["الاسم", "المعرّف", "الطوابع", "الطوابع المطلوبة", "المكافأة جاهزة", "آخر زيارة", "تاريخ الانضمام"],
};
const YES_NO: Record<Locale2, [string, string]> = { en: ["yes", "no"], ar: ["نعم", "لا"] };

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function exportRows(rows: CustomerRow[], locale: Locale2, format: "csv" | "tsv"): string {
  const cell = format === "csv" ? csvCell : tsvCell;
  const separator = format === "csv" ? "," : "\t";
  const [yes, no] = YES_NO[locale];
  const lines = [
    HEADERS[locale].map(cell).join(separator),
    ...rows.map((row) =>
      [
        row.name ?? "",
        // Without the "@": a leading @ looks like a formula to a spreadsheet and would get the apostrophe guard.
        row.username ?? "",
        row.balance,
        row.required,
        row.balance >= row.required ? yes : no,
        day(row.lastVisitAt),
        day(row.joinedAt),
      ]
        .map(cell)
        .join(separator),
    ),
  ];
  // CSV gets a byte-order mark so Excel reads Arabic names correctly; pasted text must not start with one.
  const eol = format === "csv" ? "\r\n" : "\n";
  return (format === "csv" ? "\uFEFF" : "") + lines.join(eol) + eol;
}
