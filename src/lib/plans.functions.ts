import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { planFromRow, settingsFromRows, type PlanFeature } from "@/lib/billing";
import { looseClient, rows } from "@/lib/billing-db";
import { currentOwnedStoreId } from "@/lib/current-store";
import { loadEntitlements } from "@/lib/entitlements";

export type PlanCard = { code: string; name: string; price: number; maxCashiers: number; features: PlanFeature[] };
export type MyPlan = {
  /** False while the owner has not switched limits on: everything is open and no lock should show. */
  enforced: boolean;
  current: { code: string; name: string; endsAt: string | null };
  features: PlanFeature[];
  maxCashiers: number;
  plans: PlanCard[];
};

const OPEN: MyPlan = { enforced: false, current: { code: "open", name: "", endsAt: null }, features: [], maxCashiers: 100, plans: [] };

/** Owner: what the store's plan includes, and the plans it could move to. Never fails the page: on any problem nothing is locked. */
export const getMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPlan> => {
    try {
      const storeId = await currentOwnedStoreId(context.supabase, context.userId);
      if (!storeId) return OPEN;
      const entitlements = await loadEntitlements(storeId);
      if (!entitlements.enforced) return { ...OPEN, features: entitlements.features };
      const db = await looseClient();
      const [planRows, settingRows] = await Promise.all([db.from("plans").select("*").eq("active", true).order("sort", { ascending: true }), db.from("app_settings").select("key, value")]);
      const settings = settingsFromRows(rows(settingRows, "SETTINGS").map((r) => ({ key: String(r["key"]), value: r["value"] })));
      const plans = rows(planRows, "PLANS")
        .map(planFromRow)
        .map((p) => ({ code: p.code, name: p.name, price: p.prices[settings.pricingGroup], maxCashiers: p.maxCashiers, features: p.features }));
      return {
        enforced: true,
        current: { code: entitlements.planCode, name: entitlements.planName, endsAt: entitlements.endsAt },
        features: entitlements.features,
        maxCashiers: entitlements.maxCashiers,
        plans,
      };
    } catch (error) {
      console.error("[billing] getMyPlan failed, nothing is locked", error);
      return OPEN;
    }
  });
