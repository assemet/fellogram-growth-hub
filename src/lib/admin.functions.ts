import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { check } from "@/lib/db";
import { adminClient } from "@/lib/notify";
import {
  addMonths,
  planFromRow,
  settingsFromRows,
  SETTING_KEYS,
  SUBSCRIPTION_SOURCES,
  validatePlan,
  validateSettings,
  type Plan,
  type PlatformSettings,
} from "@/lib/billing";
import { rateLimit } from "@/lib/rate-limit";

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The shared preview identity belongs to everybody who opens the app in a plain browser: never an admin. */
const PREVIEW_TELEGRAM_ID = 100000001;

/**
 * Platform owner access. Who may use it is decided by the ADMIN_TELEGRAM_IDS environment variable (comma separated
 * Telegram user ids, server only), never by a database row: nobody can promote themselves from inside the app.
 * Empty or missing means nobody is an admin. The id compared is the one stored from Telegram's signed launch data.
 */
function adminIds(): Set<number> {
  const raw = process.env["ADMIN_TELEGRAM_IDS"] ?? "";
  const ids = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isSafeInteger(value) && value > 0 && value !== PREVIEW_TELEGRAM_ID);
  return new Set(ids);
}

async function isAdmin(userId: string): Promise<boolean> {
  const allowed = adminIds();
  if (allowed.size === 0) return false;
  const admin = await adminClient();
  const { data } = check(await admin.from("profiles").select("telegram_user_id").eq("id", userId).maybeSingle(), "PROFILE_LOOKUP_FAILED");
  return data != null && allowed.has(Number(data.telegram_user_id));
}

/** Refuses with the same error a missing page would give, so the page's existence is not confirmed to others. */
async function requireAdmin(userId: string): Promise<void> {
  if (!(await isAdmin(userId))) throw new Error("NOT_FOUND");
}

/** Cheap yes/no used only to decide whether Settings shows the link. Never throws. */
export const amIAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      return { admin: await isAdmin(context.userId) };
    } catch {
      return { admin: false };
    }
  });

export type AdminStore = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  owner: string;
  customers: number;
};
export type AdminUser = { id: string; name: string; username: string | null; language: string | null; createdAt: string };
export type AdminOverview = {
  totals: { stores: number; activeStores: number; users: number; cards: number; visitedLast7Days: number; newUsersLast7Days: number; newStoresLast7Days: number };
  stores: AdminStore[];
  users: AdminUser[];
};

function personName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ").trim() || "—";
}

/** Platform owner: counts, newest stores and newest people. Read only. */
export const adminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    await requireAdmin(context.userId);
    await rateLimit("admin-read", context.userId, 60, 600);
    const db = await adminClient();
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const count = async (query: PromiseLike<{ count: number | null; error: { message: string } | null }>, label: string) =>
      check(await query, label).count ?? 0;

    const [stores, activeStores, users, cards, visited, newUsers, newStores, recentStores, recentUsers] = await Promise.all([
      count(db.from("stores").select("id", { count: "exact", head: true }), "COUNT_STORES"),
      count(db.from("stores").select("id", { count: "exact", head: true }).eq("active", true), "COUNT_ACTIVE_STORES"),
      count(db.from("profiles").select("id", { count: "exact", head: true }), "COUNT_USERS"),
      count(db.from("customer_memberships").select("id", { count: "exact", head: true }), "COUNT_CARDS"),
      count(db.from("customer_memberships").select("id", { count: "exact", head: true }).gt("last_visit_at", weekAgo), "COUNT_VISITED"),
      count(db.from("profiles").select("id", { count: "exact", head: true }).gt("created_at", weekAgo), "COUNT_NEW_USERS"),
      count(db.from("stores").select("id", { count: "exact", head: true }).gt("created_at", weekAgo), "COUNT_NEW_STORES"),
      db.from("stores").select("id, name, active, created_at, owner_id").order("created_at", { ascending: false }).limit(20),
      db.from("profiles").select("id, first_name, last_name, username, language_code, created_at").order("created_at", { ascending: false }).limit(20),
    ]);
    const storeRows = check(recentStores, "RECENT_STORES").data ?? [];
    const userRows = check(recentUsers, "RECENT_USERS").data ?? [];

    const ownerIds = [...new Set(storeRows.map((row) => row.owner_id))];
    const owners = ownerIds.length
      ? check(await db.from("profiles").select("id, first_name, last_name, username").in("id", ownerIds), "OWNERS").data ?? []
      : [];
    const ownerName = new Map(owners.map((o) => [o.id, o.username ? `${personName(o.first_name, o.last_name)} (@${o.username})` : personName(o.first_name, o.last_name)]));
    const cardCounts = await Promise.all(
      storeRows.map(async (row) =>
        count(db.from("customer_memberships").select("id", { count: "exact", head: true }).eq("store_id", row.id), "COUNT_STORE_CARDS"),
      ),
    );

    return {
      totals: { stores, activeStores, users, cards, visitedLast7Days: visited, newUsersLast7Days: newUsers, newStoresLast7Days: newStores },
      stores: storeRows.map((row, index) => ({
        id: row.id,
        name: row.name,
        active: Boolean(row.active),
        createdAt: row.created_at,
        owner: ownerName.get(row.owner_id) ?? "—",
        customers: cardCounts[index] ?? 0,
      })),
      users: userRows.map((row) => ({
        id: row.id,
        name: personName(row.first_name, row.last_name),
        username: row.username,
        language: row.language_code,
        createdAt: row.created_at,
      })),
    };
  });

/** Platform owner: suspend or restore a store. Suspended stores disappear for customers; the owner still sees theirs. */
export const adminSetStoreActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { storeId: string; active: boolean }) => {
    const storeId = String(data?.storeId ?? "");
    if (!ID_RE.test(storeId)) throw new Error("INVALID_STORE");
    if (typeof data?.active !== "boolean") throw new Error("INVALID_ACTIVE");
    return { storeId, active: data.active };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await rateLimit("admin-write", context.userId, 30, 600);
    const db = await adminClient();
    const { data: row } = check(await db.from("stores").update({ active: data.active }).eq("id", data.storeId).select("id, active").maybeSingle(), "SET_ACTIVE_FAILED");
    if (!row) throw new Error("STORE_NOT_FOUND");
    console.info(`[admin] ${context.userId} set store ${data.storeId} active=${data.active}`);
    return { id: row.id, active: Boolean(row.active) };
  });

/* ---------- Plans, platform settings and manual activation (part 96) ---------- */

/** The billing tables are not in the generated types yet, so they are reached through a small untyped door. */
type LooseResult = { data: unknown; error: { message: string } | null };
type LooseQuery = PromiseLike<LooseResult> & {
  select: (columns?: string) => LooseQuery;
  insert: (row: unknown) => LooseQuery;
  update: (row: unknown) => LooseQuery;
  upsert: (row: unknown, options?: unknown) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  lte: (column: string, value: unknown) => LooseQuery;
  gt: (column: string, value: unknown) => LooseQuery;
  order: (column: string, options?: unknown) => LooseQuery;
  limit: (count: number) => LooseQuery;
  maybeSingle: () => LooseQuery;
};
type LooseDb = { from: (table: string) => LooseQuery };
async function looseClient(): Promise<LooseDb> {
  return (await adminClient()) as unknown as LooseDb;
}
function rows(result: LooseResult, label: string): Record<string, unknown>[] {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return (result.data as Record<string, unknown>[] | null) ?? [];
}

export type AdminSubscription = { storeId: string; planCode: string; endsAt: string; source: string; note: string | null };
export type AdminBilling = { plans: Plan[]; settings: PlatformSettings; current: AdminSubscription[] };

/** Platform owner: the plans, the settings and which store holds which plan right now. */
export const adminBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminBilling> => {
    await requireAdmin(context.userId);
    await rateLimit("admin-read", context.userId, 60, 600);
    const db = await looseClient();
    const now = new Date().toISOString();
    const [planRows, settingRows, subRows] = await Promise.all([
      db.from("plans").select("*").order("sort", { ascending: true }),
      db.from("app_settings").select("key, value"),
      db.from("store_subscriptions").select("store_id, plan_code, ends_at, source, note").eq("status", "active").lte("starts_at", now).gt("ends_at", now).order("ends_at", { ascending: false }).limit(1000),
    ]);
    const seen = new Set<string>();
    const current: AdminSubscription[] = [];
    for (const r of rows(subRows, "SUBSCRIPTIONS")) {
      const storeId = String(r["store_id"]);
      if (seen.has(storeId)) continue;
      seen.add(storeId);
      current.push({ storeId, planCode: String(r["plan_code"]), endsAt: String(r["ends_at"]), source: String(r["source"]), note: (r["note"] as string | null) ?? null });
    }
    return {
      plans: rows(planRows, "PLANS").map(planFromRow),
      settings: settingsFromRows(rows(settingRows, "SETTINGS").map((r) => ({ key: String(r["key"]), value: r["value"] }))),
      current,
    };
  });

/** Platform owner: create or edit a plan (name, prices per test group, cashier limit, features, visibility). */
export const adminSavePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => validatePlan(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await rateLimit("admin-write", context.userId, 30, 600);
    const db = await looseClient();
    const result = await db.from("plans").upsert(
      { code: data.code, name: data.name, prices: data.prices, max_cashiers: data.maxCashiers, features: data.features, active: data.active, sort: data.sort, updated_at: new Date().toISOString() },
      { onConflict: "code" },
    );
    rows(result, "SAVE_PLAN_FAILED");
    console.info(`[admin] ${context.userId} saved plan ${data.code}`);
    return { ok: true as const };
  });

/** Platform owner: trial, referral and price-test settings. */
export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => validateSettings(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await rateLimit("admin-write", context.userId, 30, 600);
    const db = await looseClient();
    const now = new Date().toISOString();
    const payload = SETTING_KEYS.map((spec) => ({ key: spec.key, value: data[spec.field], updated_at: now }));
    rows(await db.from("app_settings").upsert(payload, { onConflict: "key" }), "SAVE_SETTINGS_FAILED");
    console.info(`[admin] ${context.userId} saved settings`);
    return { ok: true as const };
  });

/**
 * Platform owner: give a store a plan for N months. The same plan as today extends it (the new period starts when the
 * current one ends); another plan replaces the current one from now. Every activation stays as a row with its source.
 */
export const adminActivatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { storeId: string; planCode: string; months: number; source: string; note: string }) => {
    const storeId = String(data?.storeId ?? "");
    if (!ID_RE.test(storeId)) throw new Error("INVALID_STORE");
    const planCode = String(data?.planCode ?? "");
    if (!/^[a-z][a-z0-9_]{1,23}$/.test(planCode)) throw new Error("INVALID_PLAN");
    const months = data?.months;
    if (typeof months !== "number" || !Number.isInteger(months) || months < 1 || months > 24) throw new Error("INVALID_MONTHS");
    const source = String(data?.source ?? "manual");
    if (!(SUBSCRIPTION_SOURCES as readonly string[]).includes(source)) throw new Error("INVALID_SOURCE");
    const note = String(data?.note ?? "").replace(/\s+/g, " ").trim();
    if (note.length > 200) throw new Error("INVALID_NOTE");
    return { storeId, planCode, months, source, note };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await rateLimit("admin-write", context.userId, 30, 600);
    const db = await looseClient();
    const { data: store } = check(await (await adminClient()).from("stores").select("id").eq("id", data.storeId).maybeSingle(), "STORE_LOOKUP_FAILED");
    if (!store) throw new Error("STORE_NOT_FOUND");
    const plan = rows(await db.from("plans").select("code").eq("code", data.planCode), "PLAN_LOOKUP_FAILED")[0];
    if (!plan) throw new Error("PLAN_NOT_FOUND");

    const nowDate = new Date();
    const now = nowDate.toISOString();
    // The latest period the store holds or has queued: a repeat of the same plan queues behind it.
    const latest = rows(
      await db.from("store_subscriptions").select("plan_code, ends_at").eq("store_id", data.storeId).eq("status", "active").gt("ends_at", now).order("ends_at", { ascending: false }).limit(1),
      "CURRENT_SUBSCRIPTION_FAILED",
    )[0];

    let startsAt = nowDate;
    if (latest) {
      if (String(latest["plan_code"]) === data.planCode) {
        startsAt = new Date(String(latest["ends_at"]));
      } else {
        // Another plan replaces everything: running periods end now, queued ones are cancelled.
        rows(await db.from("store_subscriptions").update({ status: "replaced", ends_at: now }).eq("store_id", data.storeId).eq("status", "active").lte("starts_at", now).gt("ends_at", now), "REPLACE_FAILED");
        rows(await db.from("store_subscriptions").update({ status: "cancelled" }).eq("store_id", data.storeId).eq("status", "active").gt("starts_at", now), "REPLACE_FAILED");
      }
    }
    const endsAt = addMonths(startsAt, data.months);
    rows(
      await db.from("store_subscriptions").insert({
        store_id: data.storeId,
        plan_code: data.planCode,
        status: "active",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        source: data.source,
        note: data.note || null,
        created_by: context.userId,
      }),
      "ACTIVATE_FAILED",
    );
    console.info(`[admin] ${context.userId} activated ${data.planCode} x${data.months} for store ${data.storeId} (${data.source})`);
    return { endsAt: endsAt.toISOString() };
  });

/** Platform owner: end a store's current plan now. The row stays in the log as cancelled. */
export const adminCancelPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { storeId: string }) => {
    const storeId = String(data?.storeId ?? "");
    if (!ID_RE.test(storeId)) throw new Error("INVALID_STORE");
    return { storeId };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await rateLimit("admin-write", context.userId, 30, 600);
    const db = await looseClient();
    const now = new Date().toISOString();
    // Periods already running end now; extensions that have not started yet are only marked cancelled.
    rows(await db.from("store_subscriptions").update({ status: "cancelled", ends_at: now }).eq("store_id", data.storeId).eq("status", "active").lte("starts_at", now).gt("ends_at", now), "CANCEL_FAILED");
    rows(await db.from("store_subscriptions").update({ status: "cancelled" }).eq("store_id", data.storeId).eq("status", "active").gt("starts_at", now), "CANCEL_FAILED");
    console.info(`[admin] ${context.userId} cancelled plan of store ${data.storeId}`);
    return { ok: true as const };
  });
