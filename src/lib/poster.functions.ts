import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { currentOwnedStoreId } from "@/lib/current-store";
import { check } from "@/lib/db";
import { adminClient, sendTelegramDocument } from "@/lib/notify";

const MAX_POSTER_BYTES = 3 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type SendPosterResult = { ok: true } | { ok: false; reason: "no_chat" | "blocked" | "failed" };

/**
 * Phones cannot print from inside Telegram, so the owner's own poster is sent to their private chat with the bot:
 * from there it can be forwarded, saved or printed. Only the store owner can use it, and only to their own chat.
 */
export const sendJoinPoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { png: string; caption?: string }) => {
    const png = String(data?.png ?? "");
    if (!png || png.length > Math.ceil((MAX_POSTER_BYTES * 4) / 3) + 8 || !/^[A-Za-z0-9+/]+={0,2}$/.test(png)) throw new Error("POSTER_INVALID");
    return { png, caption: String(data?.caption ?? "").slice(0, 200) };
  })
  .handler(async ({ data, context }): Promise<SendPosterResult> => {
    const storeId = await currentOwnedStoreId(context.supabase, context.userId);
    if (!storeId) throw new Error("STORE_NOT_FOUND");

    const bytes = Uint8Array.from(Buffer.from(data.png, "base64"));
    if (bytes.length < 100 || bytes.length > MAX_POSTER_BYTES || !PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) throw new Error("POSTER_INVALID");

    const db = await adminClient();
    const { data: profile } = check(await db.from("profiles").select("*").eq("id", context.userId).maybeSingle(), "PROFILE_LOOKUP_FAILED");
    if (!profile?.telegram_user_id) return { ok: false, reason: "no_chat" };

    const sent = await sendTelegramDocument(Number(profile.telegram_user_id), { bytes, filename: "fellogram-poster.png", mime: "image/png" }, data.caption || undefined);
    if (sent.ok) return { ok: true };
    return { ok: false, reason: sent.blocked ? "blocked" : "failed" };
  });
