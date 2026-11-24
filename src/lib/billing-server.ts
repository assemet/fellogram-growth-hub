import { addMonths, settingsFromRows, type PlatformSettings } from "@/lib/billing";
import { looseClient, rows, type LooseDb } from "@/lib/billing-db";

/** Server-only billing logic: periods, the automatic trial and the store-to-store referral. */

const DAY = 86_400_000;

export async function loadSettings(db?: LooseDb): Promise<PlatformSettings> {
  const client = db ?? (await looseClient());
  return settingsFromRows(rows(await client.from("app_settings").select("key, value"), "SETTINGS").map((r) => ({ key: String(r["key"]), value: r["value"] })));
}

type Grant = { storeId: string; planCode: string; months?: number; days?: number; source: "manual" | "gift" | "trial" | "referral" | "stars"; note?: string | undefined; createdBy?: string | null | undefined };

/**
 * Gives a store a plan for N months (or days). The same plan as today queues behind the current period; another plan
 * replaces everything from now (running periods end now, queued ones are cancelled). Every grant stays as a row.
 */
export async function grantPeriod(db: LooseDb, grant: Grant): Promise<{ startsAt: Date; endsAt: Date }> {
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const latest = rows(
    await db.from("store_subscriptions").select("plan_code, ends_at").eq("store_id", grant.storeId).eq("status", "active").gt("ends_at", now).order("ends_at", { ascending: false }).limit(1),
    "CURRENT_SUBSCRIPTION_FAILED",
  )[0];

  let startsAt = nowDate;
  if (latest) {
    if (String(latest["plan_code"]) === grant.planCode) {
      startsAt = new Date(String(latest["ends_at"]));
    } else {
      rows(await db.from("store_subscriptions").update({ status: "replaced", ends_at: now }).eq("store_id", grant.storeId).eq("status", "active").lte("starts_at", now).gt("ends_at", now), "REPLACE_FAILED");
      rows(await db.from("store_subscriptions").update({ status: "cancelled" }).eq("store_id", grant.storeId).eq("status", "active").gt("starts_at", now), "REPLACE_FAILED");
    }
  }
  const endsAt = grant.days !== undefined ? new Date(startsAt.getTime() + grant.days * DAY) : addMonths(startsAt, grant.months ?? 1);
  rows(
    await db.from("store_subscriptions").insert({
      store_id: grant.storeId,
      plan_code: grant.planCode,
      status: "active",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      source: grant.source,
      note: grant.note ?? null,
      created_by: grant.createdBy ?? null,
    }),
    "ACTIVATE_FAILED",
  );
  return { startsAt, endsAt };
}

async function planExists(db: LooseDb, code: string): Promise<boolean> {
  return rows(await db.from("plans").select("code").eq("code", code), "PLAN_LOOKUP_FAILED").length > 0;
}

/** A new store gets the trial plan for the configured days. Safe to call for a store that already has one: it does nothing. */
export async function startTrial(storeId: string, dbArg?: LooseDb): Promise<boolean> {
  const db = dbArg ?? (await looseClient());
  const settings = await loadSettings(db);
  if (!settings.trialEnabled || settings.trialDays <= 0) return false;
  if (!(await planExists(db, settings.trialPlan))) return false;
  const any = rows(await db.from("store_subscriptions").select("id").eq("store_id", storeId).limit(1), "SUBSCRIPTION_LOOKUP_FAILED");
  if (any.length > 0) return false;
  await grantPeriod(db, { storeId, planCode: settings.trialPlan, days: settings.trialDays, source: "trial", note: "trial" });
  return true;
}

/**
 * Owner action: gives the trial to every store that has never held any plan. Returns how many stores got it.
 * Stores that ever had a period (even an expired one) are skipped, so running it twice never repeats a trial.
 */
export async function grantTrialToExistingStores(): Promise<{ granted: number; skipped: number }> {
  const db = await looseClient();
  const settings = await loadSettings(db);
  if (settings.trialDays <= 0) throw new Error("TRIAL_DISABLED");
  if (!(await planExists(db, settings.trialPlan))) throw new Error("PLAN_NOT_FOUND");
  const stores = rows(await db.from("stores").select("id").eq("active", true).limit(5000), "STORES_LOOKUP_FAILED").map((r) => String(r["id"]));
  const held = new Set(rows(await db.from("store_subscriptions").select("store_id").limit(20000), "SUBSCRIPTIONS_LOOKUP_FAILED").map((r) => String(r["store_id"])));
  let granted = 0;
  for (const storeId of stores) {
    if (held.has(storeId)) continue;
    await grantPeriod(db, { storeId, planCode: settings.trialPlan, days: settings.trialDays, source: "trial", note: "trial" });
    granted += 1;
  }
  return { granted, skipped: stores.length - granted };
}

/**
 * One extension of the trial for a store that really used it: it earned enough stamps during the trial, and nothing
 * paid is running. Checked when the owner opens the app, from three days before the trial ends to two weeks after.
 */
export async function maybeExtendTrial(storeId: string, settings: PlatformSettings, dbArg?: LooseDb): Promise<boolean> {
  if (settings.trialExtendDays <= 0) return false;
  const db = dbArg ?? (await looseClient());
  const trials = rows(await db.from("store_subscriptions").select("plan_code, starts_at, ends_at, note").eq("store_id", storeId).eq("source", "trial").order("created_at", { ascending: true }), "TRIAL_LOOKUP_FAILED");
  const initial = trials.find((r) => r["note"] === "trial");
  if (!initial || trials.some((r) => r["note"] === "trial_extension")) return false;
  const now = Date.now();
  const end = new Date(String(initial["ends_at"])).getTime();
  if (now < end - 3 * DAY || now > end + 14 * DAY) return false;

  const nowIso = new Date(now).toISOString();
  const running = rows(await db.from("store_subscriptions").select("source").eq("store_id", storeId).eq("status", "active").lte("starts_at", nowIso).gt("ends_at", nowIso), "RUNNING_LOOKUP_FAILED");
  if (running.some((r) => r["source"] !== "trial")) return false;

  if (settings.trialExtendMinStamps > 0) {
    const counted = await db.from("transactions").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("type", "stamp_awarded").gte("created_at", String(initial["starts_at"]));
    if (counted.error) throw new Error(`STAMPS_COUNT_FAILED: ${counted.error.message}`);
    if ((counted.count ?? 0) < settings.trialExtendMinStamps) return false;
  }
  await grantPeriod(db, { storeId, planCode: String(initial["plan_code"]), days: settings.trialExtendDays, source: "trial", note: "trial_extension" });
  return true;
}

/* ---------- Store-to-store referral ---------- */

const norm = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** Why two stores might be the same business. An empty list means nothing suspicious. */
export function duplicateFlags(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const flags: string[] = [];
  const nameA = norm(a["name"]);
  const nameB = norm(b["name"]);
  if (nameA && nameB && (nameA === nameB || (Math.min(nameA.length, nameB.length) >= 4 && (nameA.includes(nameB) || nameB.includes(nameA))))) flags.push("same_name");
  const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
  const phones = [digits(a["phone"]), digits(a["whatsapp"])].filter((x) => x.length >= 6);
  const otherPhones = [digits(b["phone"]), digits(b["whatsapp"])].filter((x) => x.length >= 6);
  if (phones.some((p) => otherPhones.includes(p))) flags.push("same_phone");
  const addrA = norm(a["address"]);
  if (addrA.length >= 6 && addrA === norm(b["address"])) flags.push("same_address");
  return flags;
}

/** Records that a new store was brought by another store. Anything suspicious waits for the owner's review. */
export async function registerReferral(referredStoreId: string, referrerStoreId: string, dbArg?: LooseDb): Promise<void> {
  if (referredStoreId === referrerStoreId) return;
  const db = dbArg ?? (await looseClient());
  const settings = await loadSettings(db);
  if (!settings.referralEnabled) return;
  const stores = rows(await db.from("stores").select("id, owner_id, name, phone, whatsapp, address, active").in("id", [referredStoreId, referrerStoreId]), "STORES_LOOKUP_FAILED");
  const referred = stores.find((s) => s["id"] === referredStoreId);
  const referrer = stores.find((s) => s["id"] === referrerStoreId);
  if (!referred || !referrer || referrer["active"] === false || referred["owner_id"] === referrer["owner_id"]) return;
  const flags = duplicateFlags(referred, referrer);
  const result = await db.from("store_referrals").insert({ referrer_store_id: referrerStoreId, referred_store_id: referredStoreId, status: flags.length ? "review" : "pending", flags });
  // A store can be referred once; a second attempt hits the unique key and is simply ignored.
  if (result.error && !/duplicate key/i.test(result.error.message)) throw new Error(`REFERRAL_INSERT_FAILED: ${result.error.message}`);
}

/** The first paid activation of a referred store starts the clock on both rewards. */
export async function onPaidActivation(storeId: string, dbArg?: LooseDb): Promise<void> {
  const db = dbArg ?? (await looseClient());
  const settings = await loadSettings(db);
  const row = rows(await db.from("store_referrals").select("id, status").eq("referred_store_id", storeId).is("paid_at", null).limit(1), "REFERRAL_LOOKUP_FAILED")[0];
  if (!row || (row["status"] !== "pending" && row["status"] !== "review")) return;
  const paidAt = new Date();
  const patch: Record<string, unknown> = { paid_at: paidAt.toISOString() };
  if (row["status"] === "pending") patch["reward_after"] = new Date(paidAt.getTime() + settings.referralReleaseDays * DAY).toISOString();
  rows(await db.from("store_referrals").update(patch).eq("id", row["id"]), "REFERRAL_UPDATE_FAILED");
  await processDueReferrals(db);
}

async function currentPlanCode(db: LooseDb, storeId: string): Promise<string | null> {
  const now = new Date().toISOString();
  const row = rows(await db.from("store_subscriptions").select("plan_code").eq("store_id", storeId).eq("status", "active").lte("starts_at", now).gt("ends_at", now).order("ends_at", { ascending: false }).limit(1), "CURRENT_PLAN_FAILED")[0];
  return row ? String(row["plan_code"]) : null;
}

/** Pays the rewards that are due. Each referral is claimed atomically first, so it can never be paid twice. */
export async function processDueReferrals(dbArg?: LooseDb): Promise<number> {
  const db = dbArg ?? (await looseClient());
  const settings = await loadSettings(db);
  if (!settings.referralEnabled || settings.referralRewardMonths <= 0) return 0;
  const now = new Date().toISOString();
  const due = rows(
    await db.from("store_referrals").select("id, referrer_store_id, referred_store_id").eq("status", "pending").lte("reward_after", now).limit(20),
    "REFERRAL_DUE_FAILED",
  );
  let paid = 0;
  for (const ref of due) {
    const id = String(ref["id"]);
    const claimed = rows(await db.from("store_referrals").update({ status: "rewarded", rewarded_at: now }).eq("id", id).eq("status", "pending").select("id"), "REFERRAL_CLAIM_FAILED");
    if (claimed.length === 0) continue;
    try {
      const referrerId = String(ref["referrer_store_id"]);
      const referredId = String(ref["referred_store_id"]);
      const referredPlan = await currentPlanCode(db, referredId);
      if (!referredPlan) throw new Error("REFERRED_HAS_NO_PLAN");
      const earned = rows(await db.from("store_referrals").select("reward_months").eq("referrer_store_id", referrerId).eq("status", "rewarded"), "REFERRAL_SUM_FAILED").reduce((sum, r) => sum + (Number(r["reward_months"]) || 0), 0);
      const room = settings.referralCapMonths > 0 ? Math.max(0, settings.referralCapMonths - earned) : settings.referralRewardMonths;
      const referrerMonths = Math.min(settings.referralRewardMonths, room);
      if (referrerMonths > 0) {
        const own = await currentPlanCode(db, referrerId);
        await grantPeriod(db, { storeId: referrerId, planCode: own && own !== "free" ? own : referredPlan, months: referrerMonths, source: "referral", note: "referral reward" });
      }
      await grantPeriod(db, { storeId: referredId, planCode: referredPlan, months: settings.referralRewardMonths, source: "referral", note: "referral welcome" });
      rows(await db.from("store_referrals").update({ reward_months: referrerMonths }).eq("id", id), "REFERRAL_UPDATE_FAILED");
      paid += 1;
    } catch (error) {
      console.error("[billing] referral reward failed, will retry", id, error);
      await db.from("store_referrals").update({ status: "pending", rewarded_at: null }).eq("id", id);
    }
  }
  return paid;
}

/** The owner's decision on a flagged referral. Approving it lets the reward clock run from the payment. */
export async function reviewReferral(id: string, decision: "approve" | "reject", dbArg?: LooseDb): Promise<void> {
  const db = dbArg ?? (await looseClient());
  const row = rows(await db.from("store_referrals").select("id, status, paid_at").eq("id", id).limit(1), "REFERRAL_LOOKUP_FAILED")[0];
  if (!row || row["status"] !== "review") throw new Error("REFERRAL_NOT_IN_REVIEW");
  if (decision === "reject") {
    rows(await db.from("store_referrals").update({ status: "rejected" }).eq("id", id), "REFERRAL_UPDATE_FAILED");
    return;
  }
  const settings = await loadSettings(db);
  const paidAt = row["paid_at"] ? new Date(String(row["paid_at"])) : null;
  rows(await db.from("store_referrals").update({ status: "pending", reward_after: paidAt ? new Date(paidAt.getTime() + settings.referralReleaseDays * DAY).toISOString() : null }).eq("id", id), "REFERRAL_UPDATE_FAILED");
  await processDueReferrals(db);
}
