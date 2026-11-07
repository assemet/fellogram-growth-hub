import { createServerFn } from "@tanstack/react-start";
import { ownedIdOrNil } from "@/lib/current-store";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { check, throwIfError, type Db } from "@/lib/db";
import { exportLocale, exportRows, filterCounts, isFilter, isSort, matchesFilter, sortRows, type CustomerRow, type Filter, type Sort } from "@/lib/customer-views";
import { loadNames, matchesPerson } from "@/lib/people";

async function ownedStoreId(supabase: Db, userId: string): Promise<string> {
  const { data: store } = check(
    await supabase.from("stores").select("id").eq("id", await ownedIdOrNil(supabase, userId)).maybeSingle(),
    "STORE_LOOKUP_FAILED",
  );
  if (!store) throw new Error("STORE_NOT_FOUND");
  return store.id as string;
}

const PAGE_SIZE = 1000;
/** The database returns at most 1000 rows per request; read a few pages so bigger stores are complete. */
const MAX_CUSTOMERS = 3000;
const LIST_LIMIT = 300;

async function loadCustomerRows(supabase: Db, storeId: string): Promise<CustomerRow[]> {
  const members: { customer_id: string; stamp_balance: number | null; joined_at: string; last_visit_at: string | null; loyalty_programs: { stamps_required: number } | null }[] = [];
  for (let from = 0; from < MAX_CUSTOMERS; from += PAGE_SIZE) {
    const { data } = check(
      await supabase
        .from("customer_memberships")
        .select("customer_id, stamp_balance, joined_at, last_visit_at, loyalty_programs(stamps_required)")
        .eq("store_id", storeId)
        .order("joined_at", { ascending: false })
        .order("customer_id")
        .range(from, from + PAGE_SIZE - 1),
      "CUSTOMERS_LOOKUP_FAILED",
    );
    members.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  const names = await loadNames(supabase, members.map((m) => m.customer_id));
  return members.map((m) => ({
    customerId: m.customer_id,
    name: names.get(m.customer_id)?.name ?? null,
    username: names.get(m.customer_id)?.username ?? null,
    balance: m.stamp_balance ?? 0,
    required: m.loyalty_programs?.stamps_required ?? 10,
    joinedAt: m.joined_at,
    lastVisitAt: m.last_visit_at,
  }));
}

/** Owner: the store's customers, filtered, searched and sorted, plus how many fall in each filter. */
export const getStoreCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { q?: string; filter?: string; sort?: string }) => ({
    q: String(data?.q ?? "").trim().slice(0, 60),
    filter: isFilter(data?.filter) ? data.filter : ("all" as Filter),
    sort: isSort(data?.sort) ? data.sort : ("recent" as Sort),
  }))
  .handler(async ({ data, context }) => {
    const storeId = await ownedStoreId(context.supabase, context.userId);
    const rows = await loadCustomerRows(context.supabase, storeId);
    const now = Date.now();

    const view = sortRows(
      rows.filter((row) => matchesFilter(row, data.filter, now) && matchesPerson({ name: row.name, username: row.username }, data.q)),
      data.sort,
    );
    return {
      customers: view.slice(0, LIST_LIMIT),
      shown: view.length,
      total: rows.length,
      counts: filterCounts(rows, now),
      capped: rows.length >= MAX_CUSTOMERS,
    };
  });

/** Owner: every customer as a file (CSV) or as text that pastes into spreadsheet columns (TSV). */
export const exportStoreCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { locale?: string; format?: string }) => ({
    locale: exportLocale(data?.locale),
    format: data?.format === "tsv" ? ("tsv" as const) : ("csv" as const),
  }))
  .handler(async ({ data, context }) => {
    const storeId = await ownedStoreId(context.supabase, context.userId);
    const rows = sortRows(await loadCustomerRows(context.supabase, storeId), "recent");
    return {
      text: exportRows(rows, data.locale, data.format),
      filename: `customers-${new Date().toISOString().slice(0, 10)}.csv`,
      count: rows.length,
    };
  });

/** Owner: latest stamp/redeem activity with who did it. */
export const getStoreActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const storeId = await ownedStoreId(supabase, userId);

    const { data: rows } = check(
      await supabase
        .from("transactions")
        .select("id, type, amount, created_at, customer_id, staff_id")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(60),
      "ACTIVITY_LOOKUP_FAILED",
    );
    const list = rows ?? [];
    const names = await loadNames(supabase, [...list.map((r) => r.customer_id), ...list.map((r) => r.staff_id ?? "")]);
    return {
      items: list.map((r) => ({
        id: r.id,
        type: r.type as "stamp_awarded" | "stamp_reversed" | "reward_redeemed" | "referral_reward" | "join_bonus",
        amount: r.amount,
        createdAt: r.created_at,
        customerName: names.get(r.customer_id)?.name ?? names.get(r.customer_id)?.username ?? null,
        staffName: r.staff_id ? names.get(r.staff_id)?.name ?? names.get(r.staff_id)?.username ?? null : null,
      })),
    };
  });
