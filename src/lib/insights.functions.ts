import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { check, throwIfError, type Db } from "@/lib/db";
import { loadNames, matchesPerson } from "@/lib/people";

async function ownedStoreId(supabase: Db, userId: string): Promise<string> {
  const { data: store } = check(
    await supabase.from("stores").select("id").eq("owner_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    "STORE_LOOKUP_FAILED",
  );
  if (!store) throw new Error("STORE_NOT_FOUND");
  return store.id as string;
}

/** Owner: customers of the store, most recent visitors first, optionally filtered by name. */
export const getStoreCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { q?: string }) => ({ q: String(data?.q ?? "").trim().slice(0, 60) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const storeId = await ownedStoreId(supabase, userId);

    const [rows, count] = await Promise.all([
      supabase
        .from("customer_memberships")
        .select("customer_id, stamp_balance, joined_at, last_visit_at, loyalty_programs(stamps_required)")
        .eq("store_id", storeId)
        .order("last_visit_at", { ascending: false, nullsFirst: false })
        .limit(300),
      supabase.from("customer_memberships").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    ]);
    throwIfError(rows.error ?? count.error, "CUSTOMERS_LOOKUP_FAILED");

    const members = rows.data ?? [];
    const names = await loadNames(supabase, members.map((m) => m.customer_id));
    const customers = members
      .filter((m) => matchesPerson(names.get(m.customer_id), data.q))
      .map((m) => ({
        customerId: m.customer_id,
        name: names.get(m.customer_id)?.name ?? null,
        username: names.get(m.customer_id)?.username ?? null,
        balance: m.stamp_balance ?? 0,
        required: m.loyalty_programs?.stamps_required ?? 10,
        joinedAt: m.joined_at,
        lastVisitAt: m.last_visit_at,
      }));
    return { customers, total: count.count ?? members.length, truncated: (count.count ?? 0) > members.length };
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
