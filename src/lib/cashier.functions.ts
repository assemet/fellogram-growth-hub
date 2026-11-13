import { createServerFn } from "@tanstack/react-start";
import { resolveCurrentStore } from "@/lib/current-store";
import { notifyRedemption, notifyStamp, withinBudget } from "@/lib/notify";
import { check, throwIfError } from "@/lib/db";
import { MIN_SEARCH_LENGTH, searchStoreCustomers, type SearchHit } from "@/lib/customer-search";
import { loadNames } from "@/lib/people";
import { parseOfferCode } from "@/lib/promotions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimit } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whitespace of every kind plus the invisible direction/zero-width marks that pasted text often carries. */
const INVISIBLE = /[\s\u00A0\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;
const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Accepts a scanned QR payload or something typed/pasted by hand and returns the customer uuid. Forgiving on
 * purpose: any case, a "fellogram:c:" prefix, spaces or line breaks inside (text wrapped on the customer's
 * screen), invisible marks, no hyphens, or the code pasted inside a sentence.
 */
export function parseCustomerCode(raw: string): string | null {
  const cleaned = String(raw ?? "").replace(INVISIBLE, "");
  if (/^fellogram:[roq]:/i.test(cleaned)) return null; // reward, offer and rotating customer codes are not customer ids
  const bare = cleaned.replace(/^fellogram:c:/i, "");
  const compact = bare.match(/^[0-9a-f]{32}$/i)
    ? `${bare.slice(0, 8)}-${bare.slice(8, 12)}-${bare.slice(12, 16)}-${bare.slice(16, 20)}-${bare.slice(20)}`
    : bare;
  const found = UUID_RE.test(compact) ? compact : cleaned.match(UUID_ANYWHERE)?.[0];
  return found ? found.toLowerCase() : null;
}

const QR_TOKEN_RE = /^[0-9a-f]{32}$/i;

/** A rotating customer QR ("fellogram:q:<32 hex>"): proves the customer's phone is at the counter right now. */
export function parseQrToken(raw: string): string | null {
  const token = String(raw ?? "").replace(INVISIBLE, "").match(/^fellogram:q:([0-9a-f]{32})$/i)?.[1];
  return token && QR_TOKEN_RE.test(token) ? token.toLowerCase() : null;
}

/** Resolves the store the signed-in user can stamp for (staff or owner only). */
async function resolveStaffStore(supabase: any, userId: string) {
  const current = await resolveCurrentStore(supabase, userId);
  if (!current) return null;
  // select("*") so a database without the manual-stamps column still loads (cashiers then keep the old behaviour).
  const { data: store } = check(await supabase.from("stores").select("*").eq("id", current.storeId).maybeSingle(), "STORE_LOOKUP_FAILED");
  const role = current.role as string;
  const manualSupported = Boolean(store && "staff_manual_stamp" in store);
  // Owners can always stamp by name or typed code. Cashiers only when the owner allows it (the database enforces this too).
  const manualAllowed = role === "owner" || !manualSupported || Boolean((store as { staff_manual_stamp?: boolean } | null)?.staff_manual_stamp);
  return { storeId: current.storeId, storeName: (store?.name as string | undefined) ?? "Store", role, manualAllowed };
}

/** Store context for cashier mode. Returns null for customers (no access). */
export const getCashierStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await resolveStaffStore(context.supabase, context.userId);
    if (!store) return null;

    const { data: program } = check(await context.supabase
      .from("loyalty_programs")
      .select("id, name, stamps_required")
      .eq("store_id", store.storeId)
      .eq("active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle(), "PROGRAM_LOOKUP_FAILED");

    // Owner rule: cashiers may be barred from undoing stamps (owners always can).
    const { data: storeRow } = check(await context.supabase.from("stores").select("*").eq("id", store.storeId).maybeSingle(), "STORE_LOOKUP_FAILED");
    const canUndo = store.role === "owner" || (storeRow?.staff_can_undo ?? true);

    // A running stamp event, shown to the cashier so they know visits count extra right now.
    const nowIso = new Date().toISOString();
    const { data: eventRows } = await (context.supabase as any)
      .from("stamp_events").select("name, multiplier, ends_at")
      .eq("store_id", store.storeId).eq("active", true).lte("starts_at", nowIso).gt("ends_at", nowIso)
      .order("multiplier", { ascending: false }).limit(1);
    const event = (eventRows as { name: string; multiplier: number; ends_at: string }[] | null)?.[0];

    return { ...store, canUndo, program: program ?? null, event: event ? { name: event.name, multiplier: event.multiplier, endsAt: event.ends_at } : null };
  });

type CustomerState = {
  customerId: string;
  name: string;
  membershipId: string;
  stampBalance: number;
  stampsRequired: number;
  cooldownMinutesLeft: number;
  canUndo: boolean;
  /** Stamps the latest (not undone) stamp gave, e.g. 2 during a ×2 event. */
  lastStampAmount: number;
};

async function loadCustomerState(
  supabase: any,
  storeId: string,
  customerId: string,
): Promise<CustomerState | null> {
  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }, { data: transactions, error: transactionsError }] = await Promise.all([
    supabase
      .from("customer_memberships")
      .select("id, stamp_balance, loyalty_programs(*)")
      .eq("store_id", storeId)
      .eq("customer_id", customerId)
      .maybeSingle(),
    supabase.from("profiles").select("first_name, last_name, username").eq("id", customerId).maybeSingle(),
    supabase
      .from("transactions")
      .select("id, type, amount, created_at, metadata")
      .eq("store_id", storeId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  // A failed lookup must not look like "this customer has no card here".
  throwIfError(membershipError ?? profileError ?? transactionsError, "CUSTOMER_LOOKUP_FAILED");
  if (!membership) return null;

  const rows = (transactions ?? []) as { id: string; type: string; amount: number | null; created_at: string; metadata: any }[];
  const reversedIds = new Set(
    rows.filter((r) => r.type === "stamp_reversed").map((r) => String(r.metadata?.reversed_transaction_id ?? "")),
  );
  // Reversed stamps don't count: an undone stamp must not block the next one.
  const lastStamp = rows.find((r) => r.type === "stamp_awarded" && !reversedIds.has(r.id));
  const lastStampAt = lastStamp ? new Date(lastStamp.created_at).getTime() : 0;
  const elapsedMs = lastStampAt ? Date.now() - lastStampAt : Number.MAX_SAFE_INTEGER;

  // Minutes between stamps is configurable per program (0 = no limit); 15 was the old fixed value.
  const cooldownMs = Math.max(0, Number(membership.loyalty_programs?.stamp_cooldown_minutes ?? 15)) * 60 * 1000;

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    (profile?.username ? `@${profile.username}` : "Customer");

  return {
    customerId,
    name,
    membershipId: membership.id,
    stampBalance: membership.stamp_balance ?? 0,
    stampsRequired: membership.loyalty_programs?.stamps_required ?? 10,
    cooldownMinutesLeft: elapsedMs < cooldownMs ? Math.max(1, Math.ceil((cooldownMs - elapsedMs) / 60000)) : 0,
    canUndo: Boolean(lastStamp) && elapsedMs < 30 * 60 * 1000,
    lastStampAmount: Math.max(1, Number(lastStamp?.amount ?? 1)),
  };
}

/**
 * Identify a customer inside the cashier's store. A scanned rotating QR is reserved for this cashier (and returned
 * as qrToken so the stamp can spend it); a typed code or a name picked from the list is "manual" and only works
 * when the owner allows it.
 */
export const lookupCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => {
    const token = parseQrToken(data?.code ?? "");
    if (token) return { token, customerId: null as string | null };
    const customerId = parseCustomerCode(data?.code ?? "");
    if (!customerId) throw new Error("INVALID_CODE");
    return { token: null as string | null, customerId };
  })
  .handler(async ({ data, context }) => {
    await rateLimit("lookup", context.userId, 90, 60);
    const store = await resolveStaffStore(context.supabase, context.userId);
    if (!store) throw new Error("NOT_STORE_STAFF");

    let customerId = data.customerId;
    if (data.token) {
      const { data: resolved, error } = await context.supabase.rpc("resolve_customer_qr", { _store_id: store.storeId, _token: data.token });
      if (error) throw new Error(error.message);
      customerId = String(resolved);
    } else if (!store.manualAllowed) {
      throw new Error("MANUAL_NOT_ALLOWED");
    }
    if (!customerId) throw new Error("INVALID_CODE");

    const state = await loadCustomerState(context.supabase, store.storeId, customerId);
    const qrToken = data.token;
    // No card yet: let the cashier create it at the counter instead of sending the customer away.
    if (!state) return { newCustomer: true as const, customerId, qrToken };
    return { newCustomer: false as const, ...state, qrToken };
  });

/** Award a stamp. Cooldown + staff logging are enforced in the database. */
export const awardStamp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customerId: string; amount?: number; qrToken?: string | null }) => {
    const customerId = parseCustomerCode(data?.customerId ?? "");
    if (!customerId) throw new Error("INVALID_CODE");
    const qrToken = data?.qrToken ? parseQrToken(`fellogram:q:${data.qrToken}`) : null;
    if (data?.qrToken && !qrToken) throw new Error("QR_INVALID");
    return { customerId, qrToken, amount: Math.min(5, Math.max(1, Math.round(Number(data?.amount ?? 1)))) };
  })
  .handler(async ({ data, context }) => {
    await rateLimit("award", context.userId, 60, 60);
    const store = await resolveStaffStore(context.supabase, context.userId);
    if (!store) throw new Error("NOT_STORE_STAFF");

    if (!data.qrToken && !store.manualAllowed) throw new Error("MANUAL_NOT_ALLOWED");

    const { data: awarded, error } = await context.supabase.rpc("award_stamp", {
      _store_id: store.storeId,
      _customer_id: data.customerId,
      _amount: data.amount,
      ...(data.qrToken ? { _token: data.qrToken } : {}),
    });
    if (error) throw new Error(error.message);

    // Tell the customer (if they opted in) while the screen state loads; it can never delay or fail the stamp.
    const row = Array.isArray(awarded) ? awarded[0] : awarded;
    const notified = row
      ? withinBudget(notifyStamp({ storeId: store.storeId, storeName: store.storeName, customerId: data.customerId, balance: row.stamp_balance, required: row.stamps_required }))
      : Promise.resolve();

    const state = await loadCustomerState(context.supabase, store.storeId, data.customerId);
    await notified;
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
    await rateLimit("undo", context.userId, 20, 60);
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
    await rateLimit("redeem", context.userId, 30, 60);
    const store = await resolveStaffStore(context.supabase, context.userId);
    if (!store) throw new Error("NOT_STORE_STAFF");
    const { data: rows, error } = await context.supabase.rpc("redeem_reward", {
      _store_id: store.storeId,
      _token: data.token,
    });
    // Expected refusals (used/expired/invalid) are returned, not thrown, so they don't surface as crashes.
    if (error) return { ok: false as const, error: error.message };
    const row = (rows as { customer_id: string; reward_name: string; stamps_deducted: number; stamp_balance: number }[])[0]!;
    const notified = withinBudget(notifyRedemption({ storeId: store.storeId, storeName: store.storeName, customerId: row.customer_id }));
    const state = await loadCustomerState(context.supabase, store.storeId, row.customer_id);
    await notified;
    return { ok: true as const, rewardName: row.reward_name, stampsDeducted: row.stamps_deducted, customer: state };
  });

/** Validate + consume a single-use offer token (fellogram:o:<token>). Checks run atomically in the database. */
export const redeemOfferToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { code: string }) => {
    const token = parseOfferCode(data?.code ?? "");
    if (!token) throw new Error("TOKEN_INVALID");
    return { token };
  })
  .handler(async ({ data, context }) => {
    await rateLimit("redeem-offer", context.userId, 30, 60);
    const store = await resolveStaffStore(context.supabase, context.userId);
    if (!store) throw new Error("NOT_STORE_STAFF");
    const { data: rows, error } = await context.supabase.rpc("redeem_offer" as never, { _store_id: store.storeId, _token: data.token } as never);
    if (error) return { ok: false as const, error: (error as { message: string }).message };
    const row = (rows as unknown as { out_customer_id: string; out_offer_title: string }[])[0]!;
    const customer = await loadCustomerState(context.supabase, store.storeId, row.out_customer_id);
    return { ok: true as const, offerTitle: row.out_offer_title, customer };
  });

/** Creates the customer's card at this store and adds the first stamp in one step. */
export const enrollCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customerId: string; qrToken?: string | null }) => {
    const customerId = parseCustomerCode(data?.customerId ?? "");
    if (!customerId) throw new Error("INVALID_CODE");
    const qrToken = data?.qrToken ? parseQrToken(`fellogram:q:${data.qrToken}`) : null;
    if (data?.qrToken && !qrToken) throw new Error("QR_INVALID");
    return { customerId, qrToken };
  })
  .handler(async ({ data, context }) => {
    await rateLimit("enroll", context.userId, 30, 60);
    const store = await resolveStaffStore(context.supabase, context.userId);
    if (!store) throw new Error("NOT_STORE_STAFF");
    // Refuse before creating the card, so a blocked manual stamp never leaves a card behind.
    if (!data.qrToken && !store.manualAllowed) throw new Error("MANUAL_NOT_ALLOWED");

    const { error: enrollError } = await context.supabase.rpc("staff_enroll_customer", {
      _store_id: store.storeId,
      _customer_id: data.customerId,
    });
    if (enrollError) throw new Error(enrollError.message);

    const { data: awarded, error: awardError } = await context.supabase.rpc("award_stamp", {
      _store_id: store.storeId,
      _customer_id: data.customerId,
      _amount: 1,
      ...(data.qrToken ? { _token: data.qrToken } : {}),
    });
    if (awardError) throw new Error(awardError.message);

    const row = Array.isArray(awarded) ? awarded[0] : awarded;
    const notified = row
      ? withinBudget(notifyStamp({ storeId: store.storeId, storeName: store.storeName, customerId: data.customerId, balance: row.stamp_balance, required: row.stamps_required }))
      : Promise.resolve();

    const state = await loadCustomerState(context.supabase, store.storeId, data.customerId);
    await notified;
    if (!state) throw new Error("MEMBERSHIP_NOT_FOUND");
    return state;
  });

/** Find this store's customers by name/@username, so the cashier never has to type an id. */
export const searchCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { q: string }) => ({ q: String(data?.q ?? "").trim().slice(0, 60) }))
  .handler(async ({ data, context }) => {
    await rateLimit("search", context.userId, 90, 60);
    if (data.q.length < MIN_SEARCH_LENGTH) return { results: [] as SearchHit[] };
    const store = await resolveStaffStore(context.supabase, context.userId);
    if (!store) throw new Error("NOT_STORE_STAFF");
    if (!store.manualAllowed) throw new Error("MANUAL_NOT_ALLOWED");
    return { results: await searchStoreCustomers(context.supabase, store.storeId, data.q) };
  });
