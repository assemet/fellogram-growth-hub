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
      .order("created_at", { ascending: true })
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

    const { error: memberError } = await supabase
      .from("store_members")
      .insert({ store_id: store.id, user_id: userId, role: "owner" });
    if (memberError) throw new Error(memberError.message);

    const { data: program, error: programError } = await supabase
      .from("loyalty_programs")
      .insert({
        store_id: store.id,
        name: data.programName,
        stamps_required: data.stampsRequired,
      })
      .select("id")
      .single();
    if (programError) throw new Error(programError.message);

    const { error: rewardError } = await supabase.from("rewards").insert({
      store_id: store.id,
      program_id: program.id,
      name: data.rewardName,
      stamps_required: data.stampsRequired,
      kind: "standard",
    });
    if (rewardError) throw new Error(rewardError.message);

    return { storeId: store.id };
  });
