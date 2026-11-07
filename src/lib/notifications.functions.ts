import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { botUsername, miniAppLink } from "@/lib/bot-link";
import { currentOwnedStoreId } from "@/lib/current-store";
import { check, type Db } from "@/lib/db";
import {
  adminClient,
  disableFor,
  enabledMessage,
  loadReachable,
  logSent,
  openCardLabel,
  reminderMessage,
  sendTelegramMessage,
  type Reachable,
} from "@/lib/notify";
import { localeFor } from "@/lib/notify-messages";

const INACTIVE_DAYS = 30;
const REMINDER_COOLDOWN_DAYS = 14;
const MAX_REMINDERS_PER_SEND = 100;

/** Customer: is the bot allowed to message me? "supported" is false until the database update is applied. */
export const getNotificationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle();
    const hasColumn = !error && !!data && "notifications_enabled" in data;
    return {
      supported: hasColumn && Boolean(process.env["TELEGRAM_BOT_TOKEN"]),
      enabled: hasColumn && Boolean(data?.notifications_enabled),
      bot: botUsername(),
    };
  });

type EnableResult = { ok: true } | { ok: false; reason: "no_chat" | "migration" | "blocked" | "failed" };

/** Customer: turn notifications on, proven by actually delivering a confirmation message. */
export const enableNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { locale?: string }) => ({ locale: localeFor(data?.locale) }))
  .handler(async ({ data, context }): Promise<EnableResult> => {
    const db = await adminClient();
    const { data: profile } = check(await db.from("profiles").select("*").eq("id", context.userId).maybeSingle(), "PROFILE_LOOKUP_FAILED");
    if (!profile?.telegram_user_id) return { ok: false, reason: "no_chat" };

    const update = await db.from("profiles").update({ notifications_enabled: true, language_code: data.locale }).eq("id", context.userId);
    if (update.error) {
      const missingColumn = update.error.code === "42703" || update.error.code === "PGRST204";
      return { ok: false, reason: missingColumn ? "migration" : "failed" };
    }

    const sent = await sendTelegramMessage(Number(profile.telegram_user_id), enabledMessage(localeFor(data.locale)));
    if (!sent.ok) {
      await disableFor(db, context.userId);
      return { ok: false, reason: sent.blocked ? "blocked" : "failed" };
    }
    return { ok: true };
  });

export const disableNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminClient();
    await disableFor(db, context.userId);
    return { ok: true };
  });

type Target = Reachable & { balance: number; required: number };

/** Who can be reminded: inactive for 30 days, notifications on, and not reminded in the last 14 days. */
async function reminderPlan(supabase: Db, storeId: string) {
  const db = await adminClient();
  const cutoff = Date.now() - INACTIVE_DAYS * 864e5;
  const { data: rows } = check(
    await supabase
      .from("customer_memberships")
      .select("customer_id, stamp_balance, joined_at, last_visit_at, loyalty_programs(stamps_required)")
      .eq("store_id", storeId)
      .limit(1000),
    "CUSTOMERS_LOOKUP_FAILED",
  );
  const inactive = (rows ?? []).filter((row) => new Date(row.last_visit_at ?? row.joined_at).getTime() < cutoff);
  const reachable = await loadReachable(db, inactive.map((row) => row.customer_id));

  const recently = new Set<string>();
  const since = new Date(Date.now() - REMINDER_COOLDOWN_DAYS * 864e5).toISOString();
  const ids = [...reachable.keys()];
  for (let i = 0; i < ids.length; i += 80) {
    const { data } = check(
      await db.from("notification_log").select("customer_id").eq("store_id", storeId).eq("kind", "reminder").gte("created_at", since).in("customer_id", ids.slice(i, i + 80)),
      "NOTIFICATION_LOG_FAILED",
    );
    for (const entry of data ?? []) recently.add(entry.customer_id);
  }

  const targets: Target[] = inactive
    .filter((row) => reachable.has(row.customer_id) && !recently.has(row.customer_id))
    .map((row) => ({ ...reachable.get(row.customer_id)!, balance: row.stamp_balance ?? 0, required: row.loyalty_programs?.stamps_required ?? 10 }));
  return { db, inactiveCount: inactive.length, targets };
}

async function ownerStore(supabase: Db, userId: string) {
  const storeId = await currentOwnedStoreId(supabase, userId);
  if (!storeId) throw new Error("STORE_NOT_FOUND");
  const { data: store } = check(await supabase.from("stores").select("id, name").eq("id", storeId).maybeSingle(), "STORE_LOOKUP_FAILED");
  if (!store) throw new Error("STORE_NOT_FOUND");
  return store;
}

/** Owner: how many customers have gone quiet and how many of them can be reached. */
export const getReminderSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await ownerStore(context.supabase, context.userId);
    const plan = await reminderPlan(context.supabase, store.id);
    return { days: INACTIVE_DAYS, inactive: plan.inactiveCount, reachable: plan.targets.length, perSend: MAX_REMINDERS_PER_SEND };
  });

/** Owner: send one friendly reminder to the reachable inactive customers (at most 100 per tap). */
export const sendReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const store = await ownerStore(context.supabase, context.userId);
    const { db, targets } = await reminderPlan(context.supabase, store.id);
    const batch = targets.slice(0, MAX_REMINDERS_PER_SEND);

    const delivered: Target[] = [];
    // Four at a time keeps well under Telegram's limit and inside the function's time budget.
    for (let i = 0; i < batch.length; i += 4) {
      const results = await Promise.all(
        batch.slice(i, i + 4).map(async (target) => {
          const result = await sendTelegramMessage(
            target.chatId,
            reminderMessage(target.locale, { store: store.name, balance: target.balance, required: target.required }),
            { text: openCardLabel(target.locale), url: miniAppLink(`join_${store.id}`) },
          );
          if (!result.ok && result.blocked) await disableFor(db, target.customerId);
          return { target, ok: result.ok };
        }),
      );
      for (const entry of results) if (entry.ok) delivered.push(entry.target);
    }

    await logSent(db, delivered.map((target) => ({ store_id: store.id, customer_id: target.customerId, kind: "reminder" })));
    return { sent: delivered.length, failed: batch.length - delivered.length, remaining: targets.length - batch.length };
  });

/** Best effort: keep the person's chosen app language so bot messages are written in it too. */
export const saveLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { locale?: string }) => ({ locale: localeFor(data?.locale) }))
  .handler(async ({ data, context }) => {
    const db = await adminClient();
    // Ignore the result on purpose: a database without the column must never break changing the language.
    await db.from("profiles").update({ language_code: data.locale }).eq("id", context.userId);
    return { ok: true };
  });
