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

    const logoUrl = store.logo_url
      ? (await supabase.storage.from("store-logos").createSignedUrl(store.logo_url, 3600)).data?.signedUrl ?? null
      : null;
    return { store, logoUrl, program: program ?? null, rewards: rewards ?? [], customerCount: customerCount ?? 0 };
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
          "id, store_id, stamp_balance, last_visit_at, joined_at, stores(id, name, description, logo_url, card_theme), loyalty_programs(id, name, stamps_required, stamp_icon, referrals_enabled, referrer_bonus_stamps, welcome_bonus_stamps)",
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

    const logoPaths = (memberships ?? []).flatMap((m) => m.stores?.logo_url ? [m.stores.logo_url] : []);
    const signedLogos = logoPaths.length
      ? (await supabase.storage.from("store-logos").createSignedUrls(logoPaths, 3600)).data ?? []
      : [];
    const logoMap = new Map(signedLogos.map((item) => [item.path, item.signedUrl]));

    return (memberships ?? []).map((m) => ({
      id: m.id,
      storeId: m.store_id,
      storeName: m.stores?.name ?? "Store",
      storeDescription: m.stores?.description ?? null,
      logoUrl: m.stores?.logo_url ? logoMap.get(m.stores.logo_url) ?? null : null,
      cardTheme: m.stores?.card_theme ?? "classic",
      programName: m.loyalty_programs?.name ?? "Loyalty card",
      stampIcon: m.loyalty_programs?.stamp_icon ?? "stamp",
      stampsRequired: m.loyalty_programs?.stamps_required ?? 10,
      stampBalance: m.stamp_balance ?? 0,
      referralsEnabled: m.loyalty_programs?.referrals_enabled ?? false,
      referrerBonus: m.loyalty_programs?.referrer_bonus_stamps ?? 0,
      welcomeBonus: m.loyalty_programs?.welcome_bonus_stamps ?? 0,
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
      .select("id, name, description, logo_url")
      .eq("id", data.storeId)
      .eq("active", true)
      .maybeSingle();
    if (!store) return null;

    const [{ data: program }, { data: reward }, { data: membership }] = await Promise.all([
      supabase
        .from("loyalty_programs")
        .select("id, name, stamps_required, stamp_icon")
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

    const logoUrl = store.logo_url
      ? (await supabase.storage.from("store-logos").createSignedUrl(store.logo_url, 3600)).data?.signedUrl ?? null
      : null;
    return {
      store,
      logoUrl,
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
  stampIcon: string;
  cardTheme: string;
};

/** Owner edits the stamp program and its primary reward. */
export const updateProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: UpdateProgramInput) => {
    const programName = String(data?.programName ?? "").trim() || "Loyalty Card";
    const rewardName = String(data?.rewardName ?? "").trim();
    const stampsRequired = Math.min(50, Math.max(1, Math.round(Number(data?.stampsRequired ?? 10))));
    if (rewardName.length < 2) throw new Error("REWARD_NAME_REQUIRED");
    const allowedIcons = ["coffee", "stamp", "scissors", "food", "gift", "star"];
    const stampIcon = allowedIcons.includes(String(data?.stampIcon)) ? String(data.stampIcon) : "stamp";
    const allowedThemes = ["classic", "coffee", "purple", "emerald", "midnight", "electric", "sunset"];
    if (!allowedThemes.includes(String(data?.cardTheme))) throw new Error("INVALID_CARD_THEME");
    return {
      programName,
      rewardName,
      stampsRequired,
      rewardDescription: String(data?.rewardDescription ?? "").trim() || null,
      stampIcon,
      cardTheme: data.cardTheme,
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
      .update({ name: data.programName, stamps_required: data.stampsRequired, stamp_icon: data.stampIcon })
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

    const { error: themeError } = await supabase.from("stores").update({ card_theme: data.cardTheme }).eq("id", store.id);
    if (themeError) throw new Error(themeError.message);

    return { ok: true };
  });

/** Owner attaches a private storage object to the public-facing store profile. */
export const updateStoreLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { objectPath: string | null }) => {
    const objectPath = data?.objectPath ? String(data.objectPath) : null;
    if (objectPath && !/^[0-9a-f-]{36}\/logo-[0-9]+\.[a-z0-9]+$/i.test(objectPath)) throw new Error("INVALID_LOGO");
    return { objectPath };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.objectPath && !data.objectPath.startsWith(`${userId}/`)) throw new Error("UNAUTHORIZED");
    const { data: store } = await supabase.from("stores").select("id, logo_url").eq("owner_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!store) throw new Error("STORE_NOT_FOUND");
    const previous = store.logo_url;
    const { error } = await supabase.from("stores").update({ logo_url: data.objectPath }).eq("id", store.id);
    if (error) throw new Error(error.message);
    if (previous && previous !== data.objectPath) await supabase.storage.from("store-logos").remove([previous]);
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

/** Customer's personal invite link for one store (stable per customer + store). */
export const getReferralLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { storeId: string }) => ({ storeId: String(data?.storeId ?? "") }))
  .handler(async ({ data, context }) => {
    const { data: code, error } = await context.supabase.rpc("get_referral_code", { _store_id: data.storeId });
    if (error) throw new Error(error.message);
    const bot = (process.env["TELEGRAM_BOT_USERNAME"] ?? process.env["VITE_TELEGRAM_BOT_USERNAME"] ?? "FellogramBot").replace(/^@/, "").trim();
    const param = `ref_${code}`;
    return {
      code: code as string,
      link: bot ? `https://t.me/${bot}/app?startapp=${param}` : null,
      param,
    };
  });

/** Attribute a referral when a new customer opens the app from an invite link. */
export const acceptReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { param: string }) => {
    const code = String(data?.param ?? "").trim().replace(/^ref_/, "").toLowerCase();
    if (!/^[0-9a-f]{12}$/.test(code)) throw new Error("REFERRAL_INVALID");
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("accept_referral", { _code: data.code });
    if (error) return { status: "invalid" as const, storeId: null };
    const row = (rows as { store_id: string; status: string }[])[0];
    return { status: (row?.status ?? "invalid") as "pending" | "self" | "already_member" | "disabled" | "invalid", storeId: row?.store_id ?? null };
  });

/** Owner configures referral rules. */
export const updateReferralSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { enabled: boolean; referrerBonus: number; welcomeBonus: number }) => {
    const clamp = (v: unknown) => Math.min(20, Math.max(0, Math.round(Number(v ?? 0)) || 0));
    return { enabled: Boolean(data?.enabled), referrerBonus: clamp(data?.referrerBonus), welcomeBonus: clamp(data?.welcomeBonus) };
  })
  .handler(async ({ data, context }) => {
    const storeId = await ownedStore(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("loyalty_programs")
      .update({
        referrals_enabled: data.enabled,
        referrer_bonus_stamps: data.referrerBonus,
        welcome_bonus_stamps: data.welcomeBonus,
      })
      .eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Owner growth analytics: repeat business + new-customer acquisition. */
export const getStoreAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storeId = await ownedStore(context.supabase, context.userId);
    const sb = context.supabase;
    const [{ data: members }, { data: txs }, { data: refs }] = await Promise.all([
      sb.from("customer_memberships").select("customer_id, joined_at").eq("store_id", storeId),
      sb.from("transactions").select("id, customer_id, type, amount, metadata, created_at").eq("store_id", storeId).limit(10000),
      sb.from("referrals").select("referred_customer_id, status, created_at").eq("store_id", storeId),
    ]);
    const since = Date.now() - 30 * 864e5;
    const recent = (d: string) => new Date(d).getTime() >= since;
    const all = txs ?? [];
    const reversed = new Set(all.filter((x) => x.type === "stamp_reversed").map((x) => (x.metadata as any)?.reversed_transaction_id));
    const visits = all.filter((x) => x.type === "stamp_awarded" && !reversed.has(x.id));
    const perCustomer = new Map<string, number>();
    visits.forEach((v) => perCustomer.set(v.customer_id, (perCustomer.get(v.customer_id) ?? 0) + 1));
    const customers = members ?? [];
    const returning = customers.filter((c) => (perCustomer.get(c.customer_id) ?? 0) >= 2).length;
    const redeemed = all.filter((x) => x.type === "reward_redeemed");
    const referrals = refs ?? [];
    const qualified = referrals.filter((r) => r.status !== "pending").length;
    const newCustomers = customers.filter((c) => recent(c.joined_at)).length;
    return {
      customers: customers.length,
      newCustomers,
      returning,
      repeatPct: customers.length ? Math.round((returning / customers.length) * 100) : 0,
      visits: visits.length,
      visits30: visits.filter((v) => recent(v.created_at)).length,
      stamps: visits.reduce((s, v) => s + v.amount, 0),
      rewardsRedeemed: redeemed.length,
      rewards30: redeemed.filter((r) => recent(r.created_at)).length,
      referred: referrals.length,
      referred30: referrals.filter((r) => recent(r.created_at)).length,
      qualified,
      conversionPct: referrals.length ? Math.round((qualified / referrals.length) * 100) : 0,
    };
  });
