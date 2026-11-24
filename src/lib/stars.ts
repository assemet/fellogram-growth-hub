import { planFromRow, starsAmount, STAR_MONTH_OPTIONS } from "@/lib/billing";
import { grantPeriod, loadSettings, onPaidActivation } from "@/lib/billing-server";
import { looseClient, rows, type LooseDb } from "@/lib/billing-db";

/**
 * Payments with Telegram Stars. One order row per invoice: the invoice carries only the order id, and everything
 * else (plan, months, amount) is read back from that row, so nothing the buyer's phone sends can change the price.
 */

const API_BASE = () => process.env["TELEGRAM_API_BASE"] ?? "https://api.telegram.org";
const ORDER_VALID_MS = 7 * 86_400_000;
const ORDER_PAYLOAD = /^o:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export function orderPayload(orderId: string): string {
  return `o:${orderId}`;
}
export function parseOrderPayload(payload: unknown): string | null {
  const match = typeof payload === "string" ? ORDER_PAYLOAD.exec(payload) : null;
  return match?.[1] ?? null;
}

/** Calls a Bot API method. Returns Telegram's `result`, or throws with Telegram's description. */
export async function telegramCall<T = unknown>(method: string, body: Record<string, unknown>, timeoutMs = 8000): Promise<T> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("NO_BOT_TOKEN");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE()}/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    const json = (await response.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;
    if (!json?.ok) throw new Error(`TELEGRAM_${method.toUpperCase()}_FAILED: ${json?.description ?? response.status}`);
    return json.result as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Invoice ---------- */

export type Invoice = { link: string; stars: number; orderId: string };

/** Creates the order and Telegram's invoice link for a store buying `months` of a plan. */
export async function createPlanInvoice(input: { storeId: string; userId: string; planCode: string; months: number }, dbArg?: LooseDb): Promise<Invoice> {
  const db = dbArg ?? (await looseClient());
  const settings = await loadSettings(db);
  if (!settings.starsEnabled) throw new Error("PAYMENTS_DISABLED");
  if (!(STAR_MONTH_OPTIONS as readonly number[]).includes(input.months)) throw new Error("INVALID_MONTHS");
  const planRow = rows(await db.from("plans").select("*").eq("code", input.planCode).eq("active", true), "PLAN_LOOKUP_FAILED")[0];
  if (!planRow) throw new Error("PLAN_NOT_FOUND");
  const plan = planFromRow(planRow);
  const price = plan.prices[settings.pricingGroup];
  if (plan.code === "free" || !(price > 0)) throw new Error("PLAN_NOT_FOR_SALE");
  const stars = starsAmount(price, input.months, settings.starsPerUsd);
  if (!Number.isInteger(stars) || stars < 1 || stars > 100_000) throw new Error("INVALID_AMOUNT");

  const inserted = rows(await db.from("star_payments").insert({ store_id: input.storeId, user_id: input.userId, plan_code: plan.code, months: input.months, stars }).select("id"), "ORDER_FAILED")[0];
  const orderId = String(inserted?.["id"] ?? "");
  if (!orderId) throw new Error("ORDER_FAILED");

  const link = await telegramCall<string>("createInvoiceLink", {
    title: `Fellogram ${plan.name}`.slice(0, 32),
    description: `${plan.name} · ${input.months}`.slice(0, 255),
    payload: orderPayload(orderId),
    provider_token: "",
    currency: "XTR",
    prices: [{ label: plan.name.slice(0, 32), amount: stars }],
  });
  return { link, stars, orderId };
}

/* ---------- Webhook ---------- */

type TgUser = { id: number; language_code?: string };
export type TelegramUpdate = {
  pre_checkout_query?: { id: string; from: TgUser; currency: string; total_amount: number; invoice_payload: string };
  message?: {
    chat?: { id: number };
    from?: TgUser;
    text?: string;
    successful_payment?: { currency: string; total_amount: number; invoice_payload: string; telegram_payment_charge_id: string };
  };
};

const DECLINED = "This payment is no longer valid. Please start again from the app.";

async function loadOrder(db: LooseDb, id: string): Promise<Record<string, unknown> | null> {
  return rows(await db.from("star_payments").select("*").eq("id", id).limit(1), "ORDER_LOOKUP_FAILED")[0] ?? null;
}

/** Telegram waits 10 seconds for this answer, so it only checks the order and the plan, nothing slow. */
export async function answerPreCheckout(query: NonNullable<TelegramUpdate["pre_checkout_query"]>, dbArg?: LooseDb): Promise<{ ok: boolean; error_message?: string }> {
  try {
    const db = dbArg ?? (await looseClient());
    const orderId = parseOrderPayload(query.invoice_payload);
    const order = orderId ? await loadOrder(db, orderId) : null;
    const fresh = order && Date.now() - new Date(String(order["created_at"])).getTime() < ORDER_VALID_MS;
    if (!order || !fresh || order["status"] !== "created" || query.currency !== "XTR" || query.total_amount !== Number(order["stars"])) return { ok: false, error_message: DECLINED };
    const plan = rows(await db.from("plans").select("code").eq("code", String(order["plan_code"])).eq("active", true), "PLAN_LOOKUP_FAILED")[0];
    const store = rows(await db.from("stores").select("id, active").eq("id", String(order["store_id"])), "STORE_LOOKUP_FAILED")[0];
    if (!plan || !store || store["active"] === false) return { ok: false, error_message: DECLINED };
    return { ok: true };
  } catch (error) {
    console.error("[stars] pre-checkout failed", error);
    return { ok: false, error_message: "Something went wrong. Please try again in a minute." };
  }
}

const PAID_TEXT: Record<string, string> = {
  en: "✅ Payment received. {plan} is active until {date}.",
  ar: "✅ تم استلام الدفع. باقة {plan} فعّالة حتى {date}.",
  ru: "✅ Оплата получена. Тариф {plan} действует до {date}.",
  es: "✅ Pago recibido. El plan {plan} está activo hasta el {date}.",
  tr: "✅ Ödeme alındı. {plan} paketi {date} tarihine kadar geçerli.",
  uk: "✅ Оплату отримано. Тариф {plan} діє до {date}.",
  uz: "✅ To'lov qabul qilindi. {plan} tarifi {date} gacha amal qiladi.",
  id: "✅ Pembayaran diterima. Paket {plan} aktif sampai {date}.",
  it: "✅ Pagamento ricevuto. Il piano {plan} è attivo fino al {date}.",
};

async function tellBuyer(chatId: number, language: string | undefined, planName: string, endsAt: Date) {
  try {
    const key = (language ?? "en").slice(0, 2).toLowerCase();
    const template = PAID_TEXT[key] ?? PAID_TEXT["en"]!;
    const date = endsAt.toISOString().slice(0, 10);
    await telegramCall("sendMessage", { chat_id: chatId, text: template.replace("{plan}", planName).replace("{date}", date) }, 4000);
  } catch (error) {
    console.error("[stars] could not message the buyer", error);
  }
}

/**
 * Turns a confirmed Telegram payment into a plan. Safe to call again for the same payment: the order is claimed first
 * (so a payment is counted once), and a paid order whose plan was not given yet is finished on the next call.
 * Throws when it could not give the plan, so the webhook answers 500 and Telegram sends the update again.
 */
export async function fulfillPayment(payment: NonNullable<NonNullable<TelegramUpdate["message"]>["successful_payment"]>, payer: { id: number; language?: string | undefined }, dbArg?: LooseDb): Promise<"fulfilled" | "duplicate" | "rejected"> {
  const db = dbArg ?? (await looseClient());
  const orderId = parseOrderPayload(payment.invoice_payload);
  const order = orderId ? await loadOrder(db, orderId) : null;
  if (!orderId || !order) {
    console.error("[stars] payment for an unknown order", payment.telegram_payment_charge_id, payment.invoice_payload);
    return "rejected";
  }
  if (payment.currency !== "XTR" || payment.total_amount !== Number(order["stars"])) {
    console.error("[stars] amount mismatch, plan NOT given; refund by hand", payment.telegram_payment_charge_id, payment.total_amount, order["stars"]);
    await db.from("star_payments").update({ status: "failed", charge_id: payment.telegram_payment_charge_id, payer_telegram_id: payer.id, note: "amount mismatch" }).eq("id", orderId).eq("status", "created");
    return "rejected";
  }

  const now = new Date().toISOString();
  const claimed = rows(
    await db.from("star_payments").update({ status: "paid", charge_id: payment.telegram_payment_charge_id, payer_telegram_id: payer.id, paid_at: now }).eq("id", orderId).eq("status", "created").select("id"),
    "ORDER_CLAIM_FAILED",
  );
  if (claimed.length === 0) {
    const again = await loadOrder(db, orderId);
    if (!again || again["status"] !== "paid" || again["fulfilled_at"]) return "duplicate";
  }

  // Second claim: only one caller gives the plan, and if giving it fails the claim is released for the retry.
  const take = rows(await db.from("star_payments").update({ fulfilled_at: now }).eq("id", orderId).is("fulfilled_at", null).select("id"), "FULFILL_CLAIM_FAILED");
  if (take.length === 0) return "duplicate";
  try {
    const planRow = rows(await db.from("plans").select("*").eq("code", String(order["plan_code"])), "PLAN_LOOKUP_FAILED")[0];
    const { endsAt } = await grantPeriod(db, { storeId: String(order["store_id"]), planCode: String(order["plan_code"]), months: Number(order["months"]), source: "stars", note: `stars:${payment.telegram_payment_charge_id}` });
    await onPaidActivation(String(order["store_id"]), db).catch((error) => console.error("[stars] referral follow-up failed", error));
    await tellBuyer(payer.id, payer.language, planRow ? planFromRow(planRow).name : String(order["plan_code"]), endsAt);
    return "fulfilled";
  } catch (error) {
    await db.from("star_payments").update({ fulfilled_at: null }).eq("id", orderId);
    throw error;
  }
}

/** Dispatches one webhook update. Returns what to answer Telegram with in the response body, if anything. */
export async function handleUpdate(update: TelegramUpdate, dbArg?: LooseDb): Promise<Record<string, unknown> | null> {
  if (update.pre_checkout_query) {
    const answer = await answerPreCheckout(update.pre_checkout_query, dbArg);
    return { method: "answerPreCheckoutQuery", pre_checkout_query_id: update.pre_checkout_query.id, ...answer };
  }
  const message = update.message;
  if (message?.successful_payment) {
    const payer = message.from?.id ?? message.chat?.id;
    if (typeof payer !== "number") return null;
    await fulfillPayment(message.successful_payment, { id: payer, language: message.from?.language_code }, dbArg);
    return null;
  }
  // Telegram asks every bot that takes payments to answer /paysupport.
  if (message?.text && /^\/paysupport(@\w+)?(\s|$)/i.test(message.text) && message.chat) {
    return { method: "sendMessage", chat_id: message.chat.id, text: "Payment problem? Write to us from the Settings screen in the app (Help), and include the date of the payment. Refunds for mistaken payments are handled by hand." };
  }
  return null;
}

/* ---------- Refund (owner) ---------- */

/** Returns the Stars to the buyer and ends the plan period the payment bought. */
export async function refundOrder(orderId: string, dbArg?: LooseDb): Promise<void> {
  const db = dbArg ?? (await looseClient());
  const order = await loadOrder(db, orderId);
  if (!order || order["status"] !== "paid" || !order["charge_id"] || typeof order["payer_telegram_id"] !== "number") throw new Error("ORDER_NOT_REFUNDABLE");
  await telegramCall("refundStarPayment", { user_id: order["payer_telegram_id"], telegram_payment_charge_id: String(order["charge_id"]) });
  const now = new Date().toISOString();
  rows(await db.from("star_payments").update({ status: "refunded", refunded_at: now }).eq("id", orderId), "REFUND_MARK_FAILED");
  const note = `stars:${String(order["charge_id"])}`;
  rows(await db.from("store_subscriptions").update({ status: "cancelled", ends_at: now }).eq("store_id", String(order["store_id"])).eq("note", note).eq("status", "active").lte("starts_at", now).gt("ends_at", now), "REFUND_PLAN_FAILED");
  rows(await db.from("store_subscriptions").update({ status: "cancelled" }).eq("store_id", String(order["store_id"])).eq("note", note).eq("status", "active").gt("starts_at", now), "REFUND_PLAN_FAILED");
}
