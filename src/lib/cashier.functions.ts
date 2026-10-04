import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts a scanned QR payload or a pasted id and returns the customer uuid. */
export function parseCustomerCode(raw: string): string | null {
  const value = String(raw ?? "").trim();
  const candidate = value.startsWith("fellogram:c:") ? value.slice("fellogram:c:".length) : value;
  return UUID_RE.test(candidate) ? candidate.toLowerCase() : null;
}

/** Resolves the store the signed-in user can stamp for (staff or owner only). */
async function resolveStaffStore(supabase: any, userId: string) {
  const { data: membership } = await supabase
    .from("store_members")
    .select("store_id, role, stores(id, name)")
    .eq("user_id", userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (membership?.store_id) {
    return { storeId: membership.store_id as string, storeName: membership.stores?.name ?? "Store", role: membership.role as string };
  }
  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (store) return { storeId: store.id as string, storeName: store.name as string, role: "owner" };
  return null;
}

/** Store context for cashier mode. Returns null for customers (no access). */
export const getCashierStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await resolveStaffStore(context.supabase, context.userId);
    if (!store) return null;

    const { data: program } = await context.supabase
      .from("loyalty_programs")
      .select("id, name, stamps_required")
      .eq("store_id", store.storeId)
      .eq("active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    return { ...store, program: program ?? null };
  });

type CustomerState = {
  customerId: string;
  name: string;
  membershipId: string;
  stampBalance: number;
  stampsRequired: number;
  cooldownMinutesLeft: number;
  canUndo: boolean;
};

async function loadCustomerState(
  supabase: any,
  storeId: string,
  customerId: string,
): Promise<CustomerState | null> {
  const [{ data: membership }, { data: profile }, { data: transactions }] = await Promise.all([
    supabase
      .from("customer_memberships")
      .select("id, stamp_balance, loyalty_programs(stamps_required)")
      .eq("store_id", storeId)
      .eq("customer_id", customerId)
      .maybeSingle(),
    supabase.from("profiles").select("first_name, last_name, username").eq("id", customerId).maybeSingle(),
    supabase
      .from("transactions")
      .select("id, type, created_at, metadata")
      .eq("store_id", storeId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (!membership) return null;

  const rows = (transactions ?? []) as { id: string; type: string; created_at: string; metadata: any }[];
  const reversedIds = new Set(
    rows.filter((r) => r.type === "stamp_reversed").map((r) => String(r.metadata?.reversed_transaction_id ?? "")),
  );
  // Reversed stamps don't count: an undone stamp must not block the next one.
  const lastStamp = rows.find((r) => r.type === "stamp_awarded" && !reversedIds.has(r.id));
  const lastStampAt = lastStamp ? new Date(lastStamp.created_at).getTime() : 0;
  const elapsedMs = lastStampAt ? Date.now() - lastStampAt : Number.MAX_SAFE_INTEGER;

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    (profile?.username ? `@${profile.username}` : "Customer");

  return {
    customerId,
    name,
    membershipId: membership.id,
    stampBalance: membership.stamp_balance ?? 0,
    stampsRequired: membership.loyalty_programs?.stamps_required ?? 10,
    cooldownMinutesLeft: elapsedMs < 15 * 60 * 1000 ? Math.max(1, Math.ceil((15 * 60 * 1000 - elapsedMs) / 60000)) : 0,
    canUndo: Boolean(lastStamp) && elapsedMs < 30 * 60 * 1000,
  };
}

/** Identify a scanned customer inside the cashier's store. */
export const lookupCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => {
    const customerId = parseCustomerCode(data?.code ?? "");
    if (!customerId) throw new Error("INVALID_CODE");
    return { customerId };
  })
  .handler(async ({ data, context }) => {
    const store = await resolveStaffStore(context.supabase, context.userId);
    if (!store) throw new Error("NOT_STORE_STAFF");
    const state = await loadCustomerState(context.supabase, store.storeId, data.customerId);
    if (!state) throw new Error("MEMBERSHIP_NOT_FOUND");
    return state;
  });

/** Award a stamp. Cooldown + staff logging are enforced in the database. */
export const awardStamp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customerId: string; amount?: number }) => {
    const customerId = parseCustomerCode(data?.customerId ?? "");
    if (!customerId) throw new Error("INVALID_CODE");
    return { customerId, amount: Math.min(5, Math.max(1, Math.round(Number(data?.amount ?? 1)))) };
  })
  .handler(async ({ data, context }) => {
    const store = await resolveStaffStore(context.supabase, context.userId);
    if (!store) throw new Error("NOT_STORE_STAFF");

    const { error } = await context.supabase.rpc("award_stamp", {
      _store_id: store.storeId,
      _customer_id: data.customerId,
      _amount: data.amount,
    });
    if (error) throw new Error(error.message);

    const state = await loadCustomerState(context.supabase, store.storeId, data.customerId);
    if (!state) throw new Error("MEMBERSHIP_NOT_FOUND");
    return state;
  });

/** Reverse the most recent stamp (recorded as stamp_reversed). */
export const undoLastStamp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customerId: string }) => {
    const customerId = parseCustomerCode(data?.customerId ?? "");
    if (!customerId) throw new Error("INVALID_CODE");
    return { customerId };
  })
  .handler(async ({ data, context }) => {
    const store = await resolveStaffStore(context.supabase, context.userId);
    if (!store) throw new Error("NOT_STORE_STAFF");

    const { error } = await context.supabase.rpc("undo_last_stamp", {
      _store_id: store.storeId,
      _customer_id: data.customerId,
    });
    if (error) throw new Error(error.message);

    const state = await loadCustomerState(context.supabase, store.storeId, data.customerId);
    if (!state) throw new Error("MEMBERSHIP_NOT_FOUND");
    return state;
  });

/** Parses a scanned reward QR (fellogram:r:<token>) into its token. */
export function parseRewardCode(raw: string): string | null {
  const value = String(raw ?? "").trim();
  const token = value.startsWith("fellogram:r:") ? value.slice("fellogram:r:".length) : value;
  return /^[0-9a-f]{48}$/i.test(token) ? token.toLowerCase() : null;
}

/** Validate + consume a single-use reward token. All checks run atomically in the database. */
export const redeemRewardToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => {
    const token = parseRewardCode(data?.code ?? "");
    if (!token) throw new Error("TOKEN_INVALID");
    return { token };
  })
  .handler(async ({ data, context }) => {
    const store = await resolveStaffStore(context.supabase, context.userId);
    if (!store) throw new Error("NOT_STORE_STAFF");
    const { data: rows, error } = await context.supabase.rpc("redeem_reward", {
      _store_id: store.storeId,
      _token: data.token,
    });
    // Expected refusals (used/expired/invalid) are returned, not thrown, so they don't surface as crashes.
    if (error) return { ok: false as const, error: error.message };
    const row = (rows as { customer_id: string; reward_name: string; stamps_deducted: number; stamp_balance: number }[])[0]!;
    const state = await loadCustomerState(context.supabase, store.storeId, row.customer_id);
    return { ok: true as const, rewardName: row.reward_name, stampsDeducted: row.stamps_deducted, customer: state };
  });
