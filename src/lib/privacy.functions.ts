import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";
import { CASHIER_STORE_HEADER } from "@/lib/cashier-store";
import { currentOwnedStoreId, listWorkStores } from "@/lib/current-store";
import { isDeleteWord } from "@/lib/confirm-words";
import { check, throwIfError } from "@/lib/db";
import { adminClient } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The shared preview identity belongs to everybody who opens the app in a plain browser. */
const PREVIEW_TELEGRAM_ID = 100000001;
/** Typed to confirm deleting an account: the same word in both app languages. */

/** Customer: remove my own card for a store (the store keeps its stamp history). */
export const leaveStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { storeId: string }) => {
    const storeId = String(data?.storeId ?? "");
    if (!ID_RE.test(storeId)) throw new Error("INVALID_STORE");
    return { storeId };
  })
  .handler(async ({ data, context }) => {
    const { data: removed, error } = await context.supabase.rpc("leave_store_program", { _store_id: data.storeId });
    throwIfError(error, "LEAVE_STORE_FAILED");
    return { removed: Boolean(removed) };
  });

/** Cashier: stop working for the store I am currently a cashier at. Owners delete the store instead. */
export const leaveTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Someone can own a store and still be a cashier elsewhere: leave the cashier job, never their own store.
    const teams = (await listWorkStores(context.supabase, context.userId)).filter((store) => store.role === "staff");
    if (teams.length === 0) throw new Error("NOT_ON_A_TEAM");
    const preferred = getRequest()?.headers.get(CASHIER_STORE_HEADER);
    const current = teams.find((store) => store.storeId === preferred) ?? teams[0]!;
    const { data: removed, error } = await context.supabase.rpc("leave_team", { _store_id: current.storeId });
    throwIfError(error, "LEAVE_TEAM_FAILED");
    return { removed: Boolean(removed) };
  });

/**
 * Delete my account and everything tied to it. Store owners are refused: their store (and every
 * customer's card) would go with them, so they delete the store first, deliberately.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { confirm: string }) => ({ confirm: String(data?.confirm ?? "") }))
  .handler(async ({ data, context }) => {
    await rateLimit("delete-account", context.userId, 5, 3600);
    if (!isDeleteWord(data.confirm)) throw new Error("CONFIRM_MISMATCH");

    const admin = await adminClient();
    const { data: profile } = check(await admin.from("profiles").select("telegram_user_id").eq("id", context.userId).maybeSingle(), "PROFILE_LOOKUP_FAILED");
    if (Number(profile?.telegram_user_id) === PREVIEW_TELEGRAM_ID) throw new Error("PREVIEW_ACCOUNT");
    if (await currentOwnedStoreId(context.supabase, context.userId)) throw new Error("OWNS_STORE");

    // Cards, stamp history, referrals, team membership and the profile follow through the database's cascades.
    const { error } = await admin.auth.admin.deleteUser(context.userId);
    throwIfError(error, "DELETE_ACCOUNT_FAILED");
    return { ok: true };
  });
