import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { planFromRow, type PlanFeature } from "@/lib/billing";
import { looseClient, rows } from "@/lib/billing-db";
import { currentOwnedStoreId } from "@/lib/current-store";
import { loadSettings, maybeExtendTrial, processDueReferrals } from "@/lib/billing-server";
import { miniAppLink } from "@/lib/bot-link";
import { loadEntitlements } from "@/lib/entitlements";
import { STAR_MONTH_OPTIONS } from "@/lib/billing";
import { rateLimit } from "@/lib/rate-limit";

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
  /** Paying with Telegram Stars: whether it is switched on, and how many Stars one dollar of price costs. */
  stars: { enabled: boolean; perUsd: number };
};

const OPEN: MyPlan = { enforced: false, current: { code: "open", name: "", endsAt: null, trial: false }, referral: null, features: [], maxCashiers: 100, plans: [], stars: { enabled: false, perUsd: 50 } };

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
        stars: { enabled: settings.starsEnabled, perUsd: settings.starsPerUsd },
      };
    } catch (error) {
      console.error("[billing] getMyPlan failed, nothing is locked", error);
      return OPEN;
    }
  });

/** Owner: starts a Stars payment for a plan. Returns Telegram's invoice link; the plan is given only when Telegram confirms the payment. */
export const createPlanInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { planCode: string; months: number }) => {
    if (typeof input?.planCode !== "string" || !/^[a-z0-9_-]{1,32}$/.test(input.planCode)) throw new Error("INVALID_PLAN");
    if (!(STAR_MONTH_OPTIONS as readonly number[]).includes(input.months)) throw new Error("INVALID_MONTHS");
    return { planCode: input.planCode, months: input.months };
  })
  .handler(async ({ context, data }) => {
    await rateLimit("plan-invoice", context.userId, 10, 3600);
    const storeId = await currentOwnedStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("NO_STORE");
    const { createPlanInvoice: create } = await import("@/lib/stars");
    const invoice = await create({ storeId, userId: context.userId, planCode: data.planCode, months: data.months });
    return { link: invoice.link, stars: invoice.stars };
  });
