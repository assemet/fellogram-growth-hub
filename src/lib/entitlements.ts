import { PLAN_FEATURES, planFromRow, settingsFromRows, type Plan, type PlanFeature, type PlatformSettings } from "@/lib/billing";
import { looseClient, rows } from "@/lib/billing-db";

/** What a store may use right now. While the owner's "enforce limits" switch is off, everything is allowed. */
export type Entitlements = {
  enforced: boolean;
  planCode: string;
  planName: string;
  endsAt: string | null;
  source: string | null;
  features: PlanFeature[];
  maxCashiers: number;
};

const ALL_FEATURES: PlanFeature[] = PLAN_FEATURES.map((f) => f.key);
const UNLIMITED_CASHIERS = 100;

export const OPEN_ACCESS: Entitlements = {
  enforced: false,
  planCode: "open",
  planName: "",
  endsAt: null,
  source: null,
  features: ALL_FEATURES,
  maxCashiers: UNLIMITED_CASHIERS,
};

/** Pure: settings + plans + the store's current subscription row (if any) -> what it may use. */
export function resolveEntitlements(settings: PlatformSettings, plans: Plan[], sub: { planCode: string; endsAt: string; source: string } | null): Entitlements {
  if (!settings.enforceLimits) return OPEN_ACCESS;
  const free = plans.find((p) => p.code === "free");
  const plan = (sub && plans.find((p) => p.code === sub.planCode)) || free;
  if (!plan) return { ...OPEN_ACCESS, enforced: true, planCode: "free", features: [], maxCashiers: 1 };
  return {
    enforced: true,
    planCode: plan.code,
    planName: plan.name,
    endsAt: sub && plan.code === sub.planCode ? sub.endsAt : null,
    source: sub && plan.code === sub.planCode ? sub.source : null,
    features: plan.features,
    maxCashiers: plan.maxCashiers,
  };
}

/**
 * Reads the switch, the plans and the store's current period. If the billing tables are not there yet (the SQL has
 * not been run) or anything fails, the store keeps full access: a billing problem must never lock a merchant out.
 */
export async function loadEntitlements(storeId: string): Promise<Entitlements> {
  try {
    const db = await looseClient();
    const settings = settingsFromRows(rows(await db.from("app_settings").select("key, value"), "SETTINGS").map((r) => ({ key: String(r["key"]), value: r["value"] })));
    if (!settings.enforceLimits) return OPEN_ACCESS;
    const now = new Date().toISOString();
    const [planRows, subRows] = await Promise.all([
      db.from("plans").select("*"),
      db.from("store_subscriptions").select("plan_code, ends_at, source").eq("store_id", storeId).eq("status", "active").lte("starts_at", now).gt("ends_at", now).order("ends_at", { ascending: false }).limit(1),
    ]);
    const sub = rows(subRows, "SUBSCRIPTION")[0];
    return resolveEntitlements(
      settings,
      rows(planRows, "PLANS").map(planFromRow),
      sub ? { planCode: String(sub["plan_code"]), endsAt: String(sub["ends_at"]), source: String(sub["source"]) } : null,
    );
  } catch (error) {
    console.error("[billing] entitlements lookup failed, allowing access", error);
    return OPEN_ACCESS;
  }
}

/** Throws FEATURE_LOCKED when the store's plan does not include the feature. */
export async function requireFeature(storeId: string, feature: PlanFeature): Promise<void> {
  const entitlements = await loadEntitlements(storeId);
  if (!entitlements.features.includes(feature)) throw new Error("FEATURE_LOCKED");
}

export async function hasFeature(storeId: string, feature: PlanFeature): Promise<boolean> {
  return (await loadEntitlements(storeId)).features.includes(feature);
}
