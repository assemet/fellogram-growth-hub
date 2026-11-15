import { check, type Db } from "@/lib/db";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * The single source of truth for "which store is this user working on".
 * Owned stores come first, newest first; staff memberships are only used when the user owns none.
 * Every server function must go through here, so the dashboard, the cashier, the team and the
 * customer lists can never disagree about the store (they used to pick the newest and the oldest).
 */
export async function currentOwnedStoreId(supabase: Db, userId: string): Promise<string | null> {
  const { data } = check(
    await supabase.from("stores").select("id").eq("owner_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    "STORE_LOOKUP_FAILED",
  );
  return data?.id ?? null;
}

/** Same lookup, but returns an id no row can have, so a following `.eq("id", …)` simply finds nothing. */
export async function ownedIdOrNil(supabase: Db, userId: string): Promise<string> {
  return (await currentOwnedStoreId(supabase, userId)) ?? NIL_UUID;
}

export type CurrentStore = { storeId: string; role: "owner" | "staff" };

/** The store the user can stamp for: their own newest store, otherwise their newest team membership. */
export async function resolveCurrentStore(supabase: Db, userId: string): Promise<CurrentStore | null> {
  const owned = await currentOwnedStoreId(supabase, userId);
  if (owned) return { storeId: owned, role: "owner" };

  const { data: member } = check(
    await supabase.from("store_members").select("store_id, role").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    "MEMBERSHIP_LOOKUP_FAILED",
  );
  if (!member?.store_id) return null;
  return { storeId: member.store_id, role: member.role === "owner" ? "owner" : "staff" };
}

export type WorkStore = { storeId: string; name: string; role: "owner" | "staff" };

/** Every store this person works for: their own and the ones they are a cashier at. Newest first. */
export async function listWorkStores(supabase: Db, userId: string): Promise<WorkStore[]> {
  const { data } = check(
    await supabase.from("store_members").select("store_id, role, stores(name)").eq("user_id", userId).order("created_at", { ascending: false }),
    "MEMBERSHIP_LOOKUP_FAILED",
  );
  const seen = new Set<string>();
  const list: WorkStore[] = [];
  for (const row of (data ?? []) as { store_id: string; role: string; stores: { name?: string } | null }[]) {
    if (!row.store_id || seen.has(row.store_id)) continue;
    seen.add(row.store_id);
    list.push({ storeId: row.store_id, name: row.stores?.name ?? "Store", role: row.role === "owner" ? "owner" : "staff" });
  }
  return list;
}

/** The store the cashier screen works on: the one the person picked if they belong to it, otherwise the default. */
export async function resolveWorkStore(supabase: Db, userId: string, preferredId: string | null): Promise<CurrentStore | null> {
  if (preferredId) {
    const match = (await listWorkStores(supabase, userId)).find((store) => store.storeId === preferredId);
    if (match) return { storeId: match.storeId, role: match.role };
  }
  return resolveCurrentStore(supabase, userId);
}
