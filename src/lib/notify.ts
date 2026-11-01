import { miniAppLink } from "@/lib/bot-link";
import { check, type Db } from "@/lib/db";
import {
  enabledMessage,
  localeFor,
  openCardLabel,
  reminderMessage,
  stampKind,
  stampMessage,
  type NotifyLocale,
} from "@/lib/notify-messages";

/**
 * Server-side Telegram notifications. Nothing here may block or break the action that caused it:
 * every public function swallows its own errors and uses short timeouts.
 */
const API_BASE = () => process.env["TELEGRAM_API_BASE"] ?? "https://api.telegram.org";
/** Telegram's chat id for a private chat is the user's own Telegram id. The shared preview account has no real chat. */
const PREVIEW_TELEGRAM_ID = 100000001;

export type SendResult = { ok: true } | { ok: false; blocked: boolean; error: string };

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  button?: { text: string; url: string },
  timeoutMs = 2500,
): Promise<SendResult> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return { ok: false, blocked: false, error: "NO_BOT_TOKEN" };
  if (chatId === PREVIEW_TELEGRAM_ID) return { ok: false, blocked: true, error: "PREVIEW_ACCOUNT" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE()}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(button ? { reply_markup: { inline_keyboard: [[{ text: button.text, url: button.url }]] } } : {}),
      }),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; error_code?: number; description?: string } | null;
    if (response.ok && body?.ok) return { ok: true };
    const code = body?.error_code ?? response.status;
    const description = body?.description ?? "telegram error";
    // 403: the user never started the bot or blocked it. 400 "chat not found": same for our purposes.
    const blocked = code === 403 || (code === 400 && /chat not found/i.test(description));
    return { ok: false, blocked, error: `${code}: ${description}` };
  } catch (error) {
    const aborted = (error as { name?: string } | null)?.name === "AbortError";
    return { ok: false, blocked: false, error: aborted ? "TIMEOUT" : "NETWORK_ERROR" };
  } finally {
    clearTimeout(timer);
  }
}

export async function adminClient(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

export type Reachable = { customerId: string; chatId: number; locale: NotifyLocale };

/** Customers who turned notifications on and have a real chat. Chunked so URLs stay short. */
export async function loadReachable(db: Db, customerIds: string[]): Promise<Map<string, Reachable>> {
  const result = new Map<string, Reachable>();
  const unique = [...new Set(customerIds)];
  for (let i = 0; i < unique.length; i += 80) {
    const { data } = check(await db.from("profiles").select("*").in("id", unique.slice(i, i + 80)), "PROFILES_LOOKUP_FAILED");
    for (const row of data ?? []) {
      if (row.notifications_enabled && row.telegram_user_id) {
        result.set(row.id, { customerId: row.id, chatId: Number(row.telegram_user_id), locale: localeFor(row.language_code) });
      }
    }
  }
  return result;
}

/** A blocked chat cannot receive messages: stop trying until the customer turns notifications on again. */
export async function disableFor(db: Db, customerId: string): Promise<void> {
  await db.from("profiles").update({ notifications_enabled: false }).eq("id", customerId);
}

export async function logSent(db: Db, rows: { store_id: string; customer_id: string; kind: string }[]): Promise<void> {
  if (rows.length) await db.from("notification_log").insert(rows);
}

/** After a stamp: receipt, "one to go" or "reward ready". Never throws. */
export async function notifyStamp(o: {
  storeId: string;
  storeName: string;
  customerId: string;
  balance: number;
  required: number;
}): Promise<void> {
  try {
    const db = await adminClient();
    const reachable = (await loadReachable(db, [o.customerId])).get(o.customerId);
    if (!reachable) return;

    const kind = stampKind(o.balance, o.required);
    if (kind !== "reward_ready") {
      // Rapid stamps (cooldown 0) must not flood the chat; "reward ready" always goes out.
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recent } = check(
        await db.from("notification_log").select("id").eq("store_id", o.storeId).eq("customer_id", o.customerId).gte("created_at", since).limit(1),
        "NOTIFICATION_LOG_FAILED",
      );
      if (recent?.length) return;
    }

    const text = stampMessage(reachable.locale, kind, { store: o.storeName, balance: o.balance, required: o.required });
    const result = await sendTelegramMessage(reachable.chatId, text, { text: openCardLabel(reachable.locale), url: miniAppLink(`join_${o.storeId}`) });
    if (result.ok) await logSent(db, [{ store_id: o.storeId, customer_id: o.customerId, kind }]);
    else if (result.blocked) await disableFor(db, o.customerId);
  } catch (error) {
    console.error("notifyStamp failed", (error as Error)?.message);
  }
}

/** Await a notification for at most `ms`: it must never slow the cashier down noticeably. */
export async function withinBudget(work: Promise<void>, ms = 1500): Promise<void> {
  await Promise.race([work, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

export { enabledMessage, reminderMessage, openCardLabel, localeFor };
