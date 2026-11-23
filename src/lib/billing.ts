/** Plans and platform settings (part 96). Pure helpers shared by the admin server functions and the admin page. */

export const PLAN_FEATURES = [
  { key: "redeem_note", label: "سطر المتجر في رسالة الهدية" },
  { key: "branding", label: "ألوان وشعار وأيقونات الأختام" },
  { key: "reminders", label: "تذكير الغائبين والمكافآت المنتظرة" },
  { key: "promotions", label: "العروض والفعاليات" },
  { key: "analytics", label: "التحليلات" },
  { key: "export", label: "تصدير بيانات الزبائن" },
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number]["key"];
const FEATURE_KEYS = new Set<string>(PLAN_FEATURES.map((f) => f.key));

export const PRICE_GROUPS = ["A", "B", "C"] as const;
export type PriceGroup = (typeof PRICE_GROUPS)[number];

export type Plan = {
  code: string;
  name: string;
  prices: Record<PriceGroup, number>;
  maxCashiers: number;
  features: PlanFeature[];
  active: boolean;
  sort: number;
};

export type PlatformSettings = {
  trialDays: number;
  trialExtendDays: number;
  trialExtendMinStamps: number;
  referralEnabled: boolean;
  referralRewardMonths: number;
  referralCapMonths: number;
  referralReleaseDays: number;
  pricingGroup: PriceGroup;
  /** Off until the owner is ready: while off, every store has every feature and no limits. */
  enforceLimits: boolean;
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  trialDays: 30,
  trialExtendDays: 14,
  trialExtendMinStamps: 20,
  referralEnabled: true,
  referralRewardMonths: 1,
  referralCapMonths: 12,
  referralReleaseDays: 7,
  pricingGroup: "A",
  enforceLimits: false,
};

/** Setting key in the database, its field here and the allowed range. */
export const SETTING_KEYS: { key: string; field: keyof PlatformSettings; min?: number; max?: number }[] = [
  { key: "trial_days", field: "trialDays", min: 0, max: 365 },
  { key: "trial_extend_days", field: "trialExtendDays", min: 0, max: 365 },
  { key: "trial_extend_min_stamps", field: "trialExtendMinStamps", min: 0, max: 10000 },
  { key: "referral_enabled", field: "referralEnabled" },
  { key: "referral_reward_months", field: "referralRewardMonths", min: 0, max: 24 },
  { key: "referral_cap_months", field: "referralCapMonths", min: 0, max: 120 },
  { key: "referral_release_days", field: "referralReleaseDays", min: 0, max: 90 },
  { key: "pricing_group", field: "pricingGroup" },
  { key: "enforce_limits", field: "enforceLimits" },
];

export function settingsFromRows(rows: { key: string; value: unknown }[]): PlatformSettings {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  for (const spec of SETTING_KEYS) {
    const raw = byKey.get(spec.key);
    const fallback = DEFAULT_SETTINGS[spec.field];
    if (typeof fallback === "number") {
      out[spec.field] = typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
    } else if (typeof fallback === "boolean") {
      out[spec.field] = typeof raw === "boolean" ? raw : fallback;
    } else {
      out[spec.field] = PRICE_GROUPS.includes(raw as PriceGroup) ? raw : fallback;
    }
  }
  return out as PlatformSettings;
}

/** Throws a short error code when a value is outside what the platform accepts. */
export function validateSettings(input: unknown): PlatformSettings {
  const src = (input ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const spec of SETTING_KEYS) {
    const value = src[spec.field];
    const fallback = DEFAULT_SETTINGS[spec.field];
    if (typeof fallback === "number") {
      if (typeof value !== "number" || !Number.isInteger(value) || value < (spec.min ?? 0) || value > (spec.max ?? 1000000)) throw new Error("INVALID_SETTING");
    } else if (typeof fallback === "boolean") {
      if (typeof value !== "boolean") throw new Error("INVALID_SETTING");
    } else if (!PRICE_GROUPS.includes(value as PriceGroup)) {
      throw new Error("INVALID_SETTING");
    }
    out[spec.field] = value;
  }
  return out as PlatformSettings;
}

export function planFromRow(row: Record<string, unknown>): Plan {
  const prices = (row["prices"] ?? {}) as Record<string, unknown>;
  const features = Array.isArray(row["features"]) ? (row["features"] as unknown[]).filter((f): f is PlanFeature => typeof f === "string" && FEATURE_KEYS.has(f)) : [];
  const price = (g: PriceGroup) => (typeof prices[g] === "number" && Number.isFinite(prices[g]) ? (prices[g] as number) : 0);
  return {
    code: String(row["code"]),
    name: String(row["name"]),
    prices: { A: price("A"), B: price("B"), C: price("C") },
    maxCashiers: Number(row["max_cashiers"]) || 1,
    features,
    active: Boolean(row["active"]),
    sort: Number(row["sort"]) || 0,
  };
}

export function validatePlan(input: unknown): Plan {
  const src = (input ?? {}) as Record<string, unknown>;
  const code = String(src["code"] ?? "");
  if (!/^[a-z][a-z0-9_]{1,23}$/.test(code)) throw new Error("INVALID_PLAN");
  const name = String(src["name"] ?? "").trim();
  if (name.length < 1 || name.length > 40) throw new Error("INVALID_PLAN");
  const rawPrices = (src["prices"] ?? {}) as Record<string, unknown>;
  const prices = {} as Record<PriceGroup, number>;
  for (const g of PRICE_GROUPS) {
    const p = rawPrices[g];
    if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 10000) throw new Error("INVALID_PRICE");
    prices[g] = Math.round(p * 100) / 100;
  }
  const maxCashiers = src["maxCashiers"];
  if (typeof maxCashiers !== "number" || !Number.isInteger(maxCashiers) || maxCashiers < 1 || maxCashiers > 100) throw new Error("INVALID_PLAN");
  const rawFeatures = Array.isArray(src["features"]) ? (src["features"] as unknown[]) : [];
  const features = [...new Set(rawFeatures.filter((f): f is PlanFeature => typeof f === "string" && FEATURE_KEYS.has(f)))];
  if (typeof src["active"] !== "boolean") throw new Error("INVALID_PLAN");
  const sort = Number.isInteger(src["sort"]) ? (src["sort"] as number) : 0;
  return { code, name, prices, maxCashiers, features, active: src["active"], sort };
}

export const SUBSCRIPTION_SOURCES = ["manual", "gift"] as const;

export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}
