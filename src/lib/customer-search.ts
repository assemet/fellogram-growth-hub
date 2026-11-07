import { check, type Db } from "@/lib/db";
import { loadNames, matchesPerson } from "@/lib/people";

export type SearchHit = { customerId: string; name: string | null; username: string | null; balance: number; required: number };

export const MIN_SEARCH_LENGTH = 2;
const RESULT_LIMIT = 8;
/** Fallback only: the database function (search_store_customers) searches every customer instead. */
const FALLBACK_SCAN = 300;

const fullName = (first: string | null, last: string | null) => [first, last].filter(Boolean).join(" ").trim() || null;

/**
 * Finds a store's customers by name or @username however it is typed. Uses the database function, which
 * covers the whole customer list; if the database has not been updated yet it falls back to the 300 most
 * recent customers so the cashier never loses the feature.
 */
export async function searchStoreCustomers(supabase: Db, storeId: string, query: string): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 60);
  if (q.length < MIN_SEARCH_LENGTH) return [];

  const rpc = await supabase.rpc("search_store_customers", { _store_id: storeId, _query: q, _limit: RESULT_LIMIT });
  if (!rpc.error) {
    return (rpc.data ?? []).map((row) => ({
      customerId: row.customer_id,
      name: fullName(row.first_name, row.last_name),
      username: row.username ?? null,
      balance: row.stamp_balance ?? 0,
      required: row.stamps_required ?? 10,
    }));
  }
  // 42883 / PGRST202: the function does not exist yet. Anything else is a real failure.
  if (rpc.error.code !== "42883" && rpc.error.code !== "PGRST202") throw new Error(`CUSTOMER_SEARCH_FAILED: ${rpc.error.message}`);

  const { data: rows } = check(
    await supabase
      .from("customer_memberships")
      .select("customer_id, stamp_balance, loyalty_programs(stamps_required)")
      .eq("store_id", storeId)
      .order("last_visit_at", { ascending: false, nullsFirst: false })
      .limit(FALLBACK_SCAN),
    "CUSTOMERS_LOOKUP_FAILED",
  );
  const members = rows ?? [];
  const names = await loadNames(supabase, members.map((m) => m.customer_id));
  return members
    .filter((m) => matchesPerson(names.get(m.customer_id), q))
    .slice(0, RESULT_LIMIT)
    .map((m) => ({
      customerId: m.customer_id,
      name: names.get(m.customer_id)?.name ?? null,
      username: names.get(m.customer_id)?.username ?? null,
      balance: m.stamp_balance ?? 0,
      required: m.loyalty_programs?.stamps_required ?? 10,
    }));
}
