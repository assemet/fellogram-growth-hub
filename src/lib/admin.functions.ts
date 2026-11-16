import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { check } from "@/lib/db";
import { adminClient } from "@/lib/notify";
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
