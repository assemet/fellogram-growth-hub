import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { planFromRow, type PlanFeature } from "@/lib/billing";
import { looseClient, rows } from "@/lib/billing-db";
import { currentOwnedStoreId } from "@/lib/current-store";
import { loadSettings, maybeExtendTrial, processDueReferrals } from "@/lib/billing-server";
import { miniAppLink } from "@/lib/bot-link";
import { loadEntitlements } from "@/lib/entitlements";

export type PlanCard = { code: string; name: string; price: number; maxCashiers: number; features: PlanFeature[] };
export type MyPlan = {
  /** False while the owner has not switched limits on: everything is open and no lock should show. */
  enforced: boolean;
  current: { code: string; name: string; endsAt: string | null; trial: boolean };
  /** Store-to-store referral: the owner's own link and how it is going. Null when referral is switched off. */
  referral: { link: string; rewardMonths: number; capMonths: number; invited: number; rewarded: number; earnedMonths: number } | null;
  features: PlanFeature[];
  maxCashiers: number;
  plans: PlanCard[];
};

const OPEN: MyPlan = { enforced: false, current: { code: "open", name: "", endsAt: null, trial: false }, referral: null, features: [], maxCashiers: 100, plans: [] };

/** Owner: what the store's plan includes, and the plans it could move to. Never fails the page: on any problem nothing is locked. */
export const getMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPlan> => {
    try {
      const storeId = await currentOwnedStoreId(context.supabase, context.userId);
      if (!storeId) return OPEN;
      // Opening the app is when an earned trial extension and any due referral reward are settled.
      const db = await looseClient();
      const settings = await loadSettings(db);
      await maybeExtendTrial(storeId, settings).catch((error) => console.error("[billing] trial extension failed", error));
      await processDueReferrals().catch((error) => console.error("[billing] due referrals failed", error));
      const entitlements = await loadEntitlements(storeId);
      if (!entitlements.enforced) return { ...OPEN, features: entitlements.features };
      const planRows = await db.from("plans").select("*").eq("active", true).order("sort", { ascending: true });
      const referrals = settings.referralEnabled ? rows(await db.from("store_referrals").select("status, reward_months").eq("referrer_store_id", storeId).limit(500), "REFERRALS_FAILED") : [];
      const plans = rows(planRows, "PLANS")
        .map(planFromRow)
        .map((p) => ({ code: p.code, name: p.name, price: p.prices[settings.pricingGroup], maxCashiers: p.maxCashiers, features: p.features }));
      return {
        enforced: true,
        current: { code: entitlements.planCode, name: entitlements.planName, endsAt: entitlements.endsAt, trial: entitlements.source === "trial" },
        referral: settings.referralEnabled
          ? {
              link: miniAppLink(`mref_${storeId}`),
              rewardMonths: settings.referralRewardMonths,
              capMonths: settings.referralCapMonths,
              invited: referrals.length,
              rewarded: referrals.filter((r) => r["status"] === "rewarded").length,
              earnedMonths: referrals.reduce((sum, r) => sum + (Number(r["reward_months"]) || 0), 0),
            }
          : null,
        features: entitlements.features,
        maxCashiers: entitlements.maxCashiers,
        plans,
      };
    } catch (error) {
      console.error("[billing] getMyPlan failed, nothing is locked", error);
      return OPEN;
    }
  });
