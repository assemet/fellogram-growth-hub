import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { miniAppLink } from "@/lib/bot-link";
import { check, throwIfError, type Db } from "@/lib/db";
import { loadNames } from "@/lib/people";

const TOKEN_RE = /^[0-9a-f]{64}$/i;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ownedStore(supabase: Db, userId: string): Promise<{ id: string; name: string }> {
  const { data: store } = check(
    await supabase.from("stores").select("id, name").eq("owner_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
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

    const names = await loadNames(supabase, (members.data ?? []).map((m) => m.user_id));
    return {
      storeName: store.name,
      staff: (members.data ?? []).map((m) => ({
        userId: m.user_id,
        name: names.get(m.user_id)?.name ?? null,
        username: names.get(m.user_id)?.username ?? null,
        joinedAt: m.created_at,
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
