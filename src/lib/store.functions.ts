import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Role + profile context used for splash routing. */
export const getMyContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: memberships }, { data: cards }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("store_members").select("store_id, role, stores(id, name)").eq("user_id", userId),
      supabase
        .from("customer_memberships")
        .select("id, stamp_balance, stores(name), loyalty_programs(name, stamps_required)")
        .eq("customer_id", userId),
    ]);

    const ownerMembership = (memberships ?? []).find((m) => m.role === "owner");
    const staffMembership = (memberships ?? []).find((m) => m.role === "staff");

    return {
      profile: profile ?? null,
      ownedStoreId: ownerMembership?.store_id ?? null,
      staffStoreId: staffMembership?.store_id ?? null,
      cards: cards ?? [],
    };
  });

export const getMyStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase
      .from("stores")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!store) return null;

    const [{ data: program }, { data: rewards }, { count: customerCount }] = await Promise.all([
      supabase.from("loyalty_programs").select("*").eq("store_id", store.id).limit(1).maybeSingle(),
      supabase.from("rewards").select("*").eq("store_id", store.id).order("created_at"),
      supabase
        .from("customer_memberships")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store.id),
    ]);

    return { store, program: program ?? null, rewards: rewards ?? [], customerCount: customerCount ?? 0 };
  });

type CreateStoreInput = {
  storeName: string;
  description?: string;
  programName: string;
  stampsRequired: number;
  rewardName: string;
};

/**
 * Atomic-ish store setup: store + owner membership + one stamp program + its
 * reward. All writes run as the signed-in user, so RLS still applies.
 */
export const createStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateStoreInput) => {
    const storeName = String(data?.storeName ?? "").trim();
    const programName = String(data?.programName ?? "").trim() || "Loyalty Card";
    const rewardName = String(data?.rewardName ?? "").trim();
    const stampsRequired = Math.min(100, Math.max(1, Number(data?.stampsRequired ?? 10)));
    if (storeName.length < 2) throw new Error("STORE_NAME_REQUIRED");
    if (rewardName.length < 2) throw new Error("REWARD_NAME_REQUIRED");
    return {
      storeName,
      description: String(data?.description ?? "").trim() || null,
      programName,
      rewardName,
      stampsRequired,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .insert({ owner_id: userId, name: data.storeName, description: data.description })
      .select("id")
      .single();
    if (storeError) throw new Error(storeError.message);

    // Roll back the store if any later step fails, so no half-configured
    // store is left behind.
    const rollback = async (message: string) => {
      await supabase.from("stores").delete().eq("id", store.id);
      throw new Error(message);
    };

    const { error: memberError } = await supabase
      .from("store_members")
      .insert({ store_id: store.id, user_id: userId, role: "owner" });
    if (memberError) await rollback(memberError.message);

    const { data: program, error: programError } = await supabase
      .from("loyalty_programs")
      .insert({
        store_id: store.id,
        name: data.programName,
        stamps_required: data.stampsRequired,
      })
      .select("id")
      .single();
    if (programError || !program) {
      await supabase.from("stores").delete().eq("id", store.id);
      throw new Error(programError?.message ?? "PROGRAM_CREATE_FAILED");
    }


    const { error: rewardError } = await supabase.from("rewards").insert({
      store_id: store.id,
      program_id: program.id,
      name: data.rewardName,
      stamps_required: data.stampsRequired,
      kind: "standard",
    });
    if (rewardError) await rollback(rewardError.message);

    return { storeId: store.id };
  });

/** Customer wallet: every loyalty card with program, reward and visit log. */
export const getMyCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: memberships }, { data: visits }] = await Promise.all([
      supabase
        .from("customer_memberships")
        .select(
          "id, store_id, stamp_balance, last_visit_at, joined_at, stores(id, name, description, logo_url), loyalty_programs(id, name, stamps_required)",
        )
        .eq("customer_id", userId)
        .order("joined_at", { ascending: false }),
      supabase
        .from("transactions")
        .select("id, store_id, type, amount, created_at")
        .eq("customer_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const storeIds = (memberships ?? []).map((m) => m.store_id);
    const { data: rewards } = storeIds.length
      ? await supabase
          .from("rewards")
          .select("id, store_id, name, description, stamps_required, kind, active")
          .in("store_id", storeIds)
          .eq("active", true)
      : { data: [] as { id: string; store_id: string; name: string; description: string | null; stamps_required: number; kind: string; active: boolean }[] };

    return (memberships ?? []).map((m) => ({
      id: m.id,
      storeId: m.store_id,
      storeName: m.stores?.name ?? "Store",
      storeDescription: m.stores?.description ?? null,
      programName: m.loyalty_programs?.name ?? "Loyalty card",
      stampsRequired: m.loyalty_programs?.stamps_required ?? 10,
      stampBalance: m.stamp_balance ?? 0,
      lastVisitAt: m.last_visit_at,
      reward:
        (rewards ?? []).find((r) => r.store_id === m.store_id && r.kind === "standard")?.name ??
        (rewards ?? []).find((r) => r.store_id === m.store_id)?.name ??
        null,
      rewards: (rewards ?? [])
        .filter((r) => r.store_id === m.store_id)
        .sort((a, b) => a.stamps_required - b.stamps_required)
        .map((r) => ({ id: r.id, name: r.name, description: r.description, stampsRequired: r.stamps_required })),
      visits: (visits ?? [])
        .filter((v) => v.store_id === m.store_id)
        .slice(0, 5)
        .map((v) => ({ id: v.id, type: v.type, amount: v.amount, createdAt: v.created_at })),
    }));
  });

/** Public-ish store card shown before joining (signed-in Mini App users). */
export const getStoreForJoin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { storeId: string }) => ({ storeId: String(data?.storeId ?? "") }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase
      .from("stores")
      .select("id, name, description")
      .eq("id", data.storeId)
      .eq("active", true)
      .maybeSingle();
    if (!store) return null;

    const [{ data: program }, { data: reward }, { data: membership }] = await Promise.all([
      supabase
        .from("loyalty_programs")
        .select("id, name, stamps_required")
        .eq("store_id", store.id)
        .eq("active", true)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("rewards")
        .select("id, name, description")
        .eq("store_id", store.id)
        .eq("active", true)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("customer_memberships")
        .select("id")
        .eq("store_id", store.id)
        .eq("customer_id", userId)
        .maybeSingle(),
    ]);

    return {
      store,
      program: program ?? null,
      reward: reward ?? null,
      alreadyJoined: Boolean(membership),
    };
  });

/** Join a store's loyalty program. Idempotent — returns the existing card. */
export const joinStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { storeId: string }) => ({ storeId: String(data?.storeId ?? "") }))
  .handler(async ({ data, context }) => {
    const { data: membershipId, error } = await context.supabase.rpc("join_store_program", {
      _store_id: data.storeId,
    });
    if (error) throw new Error(error.message);
    return { membershipId };
  });

type UpdateProgramInput = {
  programName: string;
  stampsRequired: number;
  rewardName: string;
  rewardDescription?: string;
};

/** Owner edits the stamp program and its primary reward. */
export const updateProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: UpdateProgramInput) => {
    const programName = String(data?.programName ?? "").trim() || "Loyalty Card";
    const rewardName = String(data?.rewardName ?? "").trim();
    const stampsRequired = Math.min(50, Math.max(1, Math.round(Number(data?.stampsRequired ?? 10))));
    if (rewardName.length < 2) throw new Error("REWARD_NAME_REQUIRED");
    return {
      programName,
      rewardName,
      stampsRequired,
      rewardDescription: String(data?.rewardDescription ?? "").trim() || null,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!store) throw new Error("STORE_NOT_FOUND");

    const { data: program } = await supabase
      .from("loyalty_programs")
      .select("id")
      .eq("store_id", store.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!program) throw new Error("PROGRAM_NOT_FOUND");

    const { error: programError } = await supabase
      .from("loyalty_programs")
      .update({ name: data.programName, stamps_required: data.stampsRequired })
      .eq("id", program.id);
    if (programError) throw new Error(programError.message);

    const { data: reward } = await supabase
      .from("rewards")
      .select("id")
      .eq("store_id", store.id)
      .eq("kind", "standard")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (reward) {
      const { error } = await supabase
        .from("rewards")
        .update({
          name: data.rewardName,
          description: data.rewardDescription,
          stamps_required: data.stampsRequired,
        })
        .eq("id", reward.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("rewards").insert({
        store_id: store.id,
        program_id: program.id,
        name: data.rewardName,
        description: data.rewardDescription,
        stamps_required: data.stampsRequired,
        kind: "standard",
      });
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

/** Customer requests a short-lived, single-use redemption token (5 min). */
export const requestRedemption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rewardId: string }) => {
    const rewardId = String(data?.rewardId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(rewardId)) throw new Error("REWARD_NOT_FOUND");
    return { rewardId };
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("create_redemption", { _reward_id: data.rewardId });
    if (error) throw new Error(error.message);
    const row = (rows as { redemption_id: string; token: string; expires_at: string }[])[0]!;
    return { token: row.token, expiresAt: row.expires_at };
  });

async function ownedStore(supabase: any, userId: string) {
  const { data: store } = await supabase
    .from("stores").select("id").eq("owner_id", userId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!store) throw new Error("STORE_NOT_FOUND");
  return store.id as string;
}

/** Owner creates or edits an extra reward. */
export const saveReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id?: string; name: string; description?: string; stampsRequired: number }) => {
    const name = String(data?.name ?? "").trim().slice(0, 80);
    if (name.length < 2) throw new Error("REWARD_NAME_REQUIRED");
    return {
      id: data?.id ? String(data.id) : undefined,
      name,
      description: String(data?.description ?? "").trim().slice(0, 300) || null,
      stampsRequired: Math.min(50, Math.max(1, Math.round(Number(data?.stampsRequired ?? 10)))),
    };
  })
  .handler(async ({ data, context }) => {
    const storeId = await ownedStore(context.supabase, context.userId);
    const payload = { name: data.name, description: data.description, stamps_required: data.stampsRequired };
    if (data.id) {
      const { error } = await context.supabase.from("rewards").update(payload).eq("id", data.id).eq("store_id", storeId);
      if (error) throw new Error(error.message);
    } else {
      const { data: program } = await context.supabase
        .from("loyalty_programs").select("id").eq("store_id", storeId).order("created_at").limit(1).maybeSingle();
      const { error } = await context.supabase
        .from("rewards").insert({ ...payload, store_id: storeId, program_id: program?.id ?? null, kind: "standard" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Owner retires a reward (kept for history, hidden from customers). */
export const archiveReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ data, context }) => {
    const storeId = await ownedStore(context.supabase, context.userId);
    const { error } = await context.supabase.from("rewards").update({ active: false }).eq("id", data.id).eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
