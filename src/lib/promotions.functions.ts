import { createServerFn } from "@tanstack/react-start";
import { ownedIdOrNil } from "@/lib/current-store";
import { check } from "@/lib/db";
import { parseWindow } from "@/lib/promotions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// stamp_events / offers / offer_redemptions are newer than the generated Supabase types.
const table = (supabase: any, name: string) => supabase.from(name);

async function ownedStore(supabase: any, userId: string): Promise<string> {
  const { data: store } = check(await supabase.from("stores").select("id").eq("id", await ownedIdOrNil(supabase, userId)).maybeSingle(), "STORE_LOOKUP_FAILED");
  if (!store) throw new Error("STORE_NOT_FOUND");
  return store.id as string;
}

type EventRow = { id: string; name: string; multiplier: number; starts_at: string; ends_at: string; active: boolean };
type OfferRow = { id: string; title: string; details: string | null; starts_at: string; ends_at: string; active: boolean };

/** Owner: every event and offer of the store, newest first, with how many times each offer was used. */
export const getPromotions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const storeId = await ownedStore(supabase, context.userId);
    const { data: store } = check(await supabase.from("stores").select("name").eq("id", storeId).maybeSingle(), "STORE_LOOKUP_FAILED");

    const [events, offers, used] = await Promise.all([
      table(supabase, "stamp_events").select("id, name, multiplier, starts_at, ends_at, active").eq("store_id", storeId).order("starts_at", { ascending: false }).limit(50),
      table(supabase, "offers").select("id, title, details, starts_at, ends_at, active").eq("store_id", storeId).order("starts_at", { ascending: false }).limit(50),
      table(supabase, "offer_redemptions").select("offer_id").eq("store_id", storeId).eq("status", "used").limit(5000),
    ]);
    check(events, "EVENTS_LOOKUP_FAILED");
    check(offers, "OFFERS_LOOKUP_FAILED");
    check(used, "OFFER_USAGE_LOOKUP_FAILED");

    const counts = new Map<string, number>();
    for (const row of (used.data ?? []) as { offer_id: string }[]) counts.set(row.offer_id, (counts.get(row.offer_id) ?? 0) + 1);

    return {
      storeName: (store?.name as string | undefined) ?? "",
      events: ((events.data ?? []) as EventRow[]).map((e) => ({ id: e.id, name: e.name, multiplier: e.multiplier, startsAt: e.starts_at, endsAt: e.ends_at, active: e.active })),
      offers: ((offers.data ?? []) as OfferRow[]).map((o) => ({ id: o.id, title: o.title, details: o.details, startsAt: o.starts_at, endsAt: o.ends_at, active: o.active, used: counts.get(o.id) ?? 0 })),
    };
  });

export const saveStampEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; multiplier: number; startsAt: string; endsAt: string }) => {
    const name = String(data?.name ?? "").trim().slice(0, 60);
    if (name.length < 2) throw new Error("NAME_REQUIRED");
    const multiplier = Math.round(Number(data?.multiplier));
    if (!(multiplier >= 2 && multiplier <= 5)) throw new Error("INVALID_MULTIPLIER");
    return { name, multiplier, ...parseWindow(data?.startsAt, data?.endsAt) };
  })
  .handler(async ({ data, context }) => {
    const storeId = await ownedStore(context.supabase, context.userId);
    const { error } = await table(context.supabase, "stamp_events").insert({
      store_id: storeId, name: data.name, multiplier: data.multiplier, starts_at: data.startsAt, ends_at: data.endsAt,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { title: string; details?: string; startsAt: string; endsAt: string }) => {
    const title = String(data?.title ?? "").trim().slice(0, 80);
    if (title.length < 2) throw new Error("NAME_REQUIRED");
    return { title, details: String(data?.details ?? "").trim().slice(0, 300) || null, ...parseWindow(data?.startsAt, data?.endsAt) };
  })
  .handler(async ({ data, context }) => {
    const storeId = await ownedStore(context.supabase, context.userId);
    const { error } = await table(context.supabase, "offers").insert({
      store_id: storeId, title: data.title, details: data.details, starts_at: data.startsAt, ends_at: data.endsAt,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Stops an event or offer right away (kept for history). */
export const stopPromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { kind: "event" | "offer"; id: string }) => {
    const id = String(data?.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("NOT_FOUND");
    return { kind: data?.kind === "offer" ? ("offer" as const) : ("event" as const), id };
  })
  .handler(async ({ data, context }) => {
    const storeId = await ownedStore(context.supabase, context.userId);
    const { error } = await table(context.supabase, data.kind === "offer" ? "offers" : "stamp_events")
      .update({ active: false }).eq("id", data.id).eq("store_id", storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Customer: short-lived single-use code for an offer. */
export const requestOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { offerId: string }) => {
    const offerId = String(data?.offerId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(offerId)) throw new Error("OFFER_NOT_FOUND");
    return { offerId };
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("create_offer_redemption" as never, { _offer_id: data.offerId } as never);
    if (error) throw new Error((error as { message: string }).message);
    const row = (rows as unknown as { out_token: string; out_expires_at: string }[])[0]!;
    return { token: row.out_token, expiresAt: row.out_expires_at };
  });
