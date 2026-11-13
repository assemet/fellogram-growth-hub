import { createServerFn } from "@tanstack/react-start";
import { ownedIdOrNil } from "@/lib/current-store";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { miniAppLink } from "@/lib/bot-link";
import { check, throwIfError, type Db } from "@/lib/db";
import { loadNames } from "@/lib/people";

const TOKEN_RE = /^[0-9a-f]{64}$/i;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownedStore(supabase: Db, userId: string): Promise<{ id: string; name: string }> {
  const { data: store } = check(
    await supabase.from("stores").select("id, name").eq("id", await ownedIdOrNil(supabase, userId)).maybeSingle(),
    "STORE_LOOKUP_FAILED",
  );
  if (!store) throw new Error("STORE_NOT_FOUND");
  return store as { id: string; name: string };
}

function inviteLink(token: string) {
  return miniAppLink(`staff_${token}`);
}

/** Owner: current cashiers and open (unused, unexpired) invitation links. */
export const getTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const store = await ownedStore(supabase, userId);

    const [members, invitations] = await Promise.all([
      supabase.from("store_members").select("user_id, created_at").eq("store_id", store.id).eq("role", "staff").order("created_at"),
      supabase
        .from("staff_invitations")
        .select("id, token, expires_at, created_at")
        .eq("store_id", store.id)
        .is("used_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
    ]);
    throwIfError(members.error ?? invitations.error, "TEAM_LOOKUP_FAILED");

    // select("*") so a database without the team-rules columns still loads (rules then read as defaults).
    const { data: storeRow } = check(await supabase.from("stores").select("*").eq("id", store.id).maybeSingle(), "STORE_LOOKUP_FAILED");
    const rules = {
      supported: Boolean(storeRow && "staff_can_undo" in storeRow),
      canUndo: storeRow?.staff_can_undo ?? true,
      dailyLimit: storeRow?.staff_daily_stamp_limit ?? 0,
      manualSupported: Boolean(storeRow && "staff_manual_stamp" in storeRow),
      manualStamp: Boolean((storeRow as { staff_manual_stamp?: boolean } | null)?.staff_manual_stamp),
    };

    // Last 7 days per cashier: stamps given (undone ones excluded) and how many were found by name / typed code.
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    // A failed stats query must not stop the team page from loading.
    const { data: weekRows } = (
      await supabase
        .from("transactions")
        .select("id, type, staff_id, metadata")
        .eq("store_id", store.id)
        .in("type", ["stamp_awarded", "stamp_reversed"])
        .gte("created_at", since)
        .limit(5000)
    );
    const week = (weekRows ?? []) as { id: string; type: string; staff_id: string | null; metadata: { method?: string; reversed_transaction_id?: string } | null }[];
    const reversed = new Set(week.filter((r) => r.type === "stamp_reversed").map((r) => String(r.metadata?.reversed_transaction_id ?? "")));
    const stats = new Map<string, { stamps: number; manual: number }>();
    for (const row of week) {
      if (row.type !== "stamp_awarded" || !row.staff_id || reversed.has(row.id)) continue;
      const entry = stats.get(row.staff_id) ?? { stamps: 0, manual: 0 };
      entry.stamps += 1;
      if (row.metadata?.method === "manual") entry.manual += 1;
      stats.set(row.staff_id, entry);
    }

    const names = await loadNames(supabase, (members.data ?? []).map((m) => m.user_id));
    return {
      storeName: store.name,
      rules,
      staff: (members.data ?? []).map((m) => ({
        userId: m.user_id,
        name: names.get(m.user_id)?.name ?? null,
        username: names.get(m.user_id)?.username ?? null,
        joinedAt: m.created_at,
        weekStamps: stats.get(m.user_id)?.stamps ?? 0,
        weekManual: stats.get(m.user_id)?.manual ?? 0,
      })),
      invitations: (invitations.data ?? []).map((i) => ({
        id: i.id,
        link: inviteLink(i.token),
        expiresAt: i.expires_at,
        createdAt: i.created_at,
      })),
    };
  });

/** Owner: create a single-use cashier invitation (valid 7 days). */
export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await ownedStore(context.supabase, context.userId);
    const { data: token, error } = await context.supabase.rpc("create_staff_invitation", { _store_id: store.id });
    if (error) throw new Error(error.message);
    return { link: inviteLink(String(token)), storeName: store.name };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    const id = String(data?.id ?? "");
    if (!ID_RE.test(id)) throw new Error("INVITE_INVALID");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("revoke_staff_invitation", { _invitation_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Owner: take cashier access away (the person's customer cards are untouched). */
export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => {
    const userId = String(data?.userId ?? "");
    if (!ID_RE.test(userId)) throw new Error("INVALID_USER");
    return { userId };
  })
  .handler(async ({ data, context }) => {
    const store = await ownedStore(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("store_members")
      .delete()
      .eq("store_id", store.id)
      .eq("user_id", data.userId)
      .eq("role", "staff");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Invited person: join the team from a link. Returns the store id. */
export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) => {
    const token = String(data?.token ?? "").trim();
    if (!TOKEN_RE.test(token)) throw new Error("INVITE_INVALID");
    return { token: token.toLowerCase() };
  })
  .handler(async ({ data, context }) => {
    const { data: storeId, error } = await context.supabase.rpc("accept_staff_invitation", { _token: data.token });
    if (error) throw new Error(error.message);
    return { storeId: String(storeId) };
  });

/** Owner: what cashiers may do. Owners themselves are never limited. */
export const updateTeamRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { canUndo: boolean; dailyLimit: number; manualStamp: boolean }) => ({
    canUndo: Boolean(data?.canUndo),
    manualStamp: Boolean(data?.manualStamp),
    dailyLimit: Math.min(1000, Math.max(0, Math.round(Number(data?.dailyLimit)) || 0)),
  }))
  .handler(async ({ data, context }) => {
    const store = await ownedStore(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("stores")
      .update({ staff_can_undo: data.canUndo, staff_daily_stamp_limit: data.dailyLimit, staff_manual_stamp: data.manualStamp })
      .eq("id", store.id);
    if (error) {
      // 42703 / PGRST204: the privacy-and-team-rules migration has not been applied to this database yet.
      if (error.code === "42703" || error.code === "PGRST204") throw new Error("DB_MIGRATION_REQUIRED");
      throw new Error(error.message);
    }
    return { ok: true };
  });
