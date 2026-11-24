import { timingSafeEqual } from "node:crypto";

import { createFileRoute } from "@tanstack/react-router";

/**
 * Telegram's webhook: payment confirmations (pre-checkout and successful payment) arrive here. Every request must
 * carry the secret token set with setWebhook (TELEGRAM_WEBHOOK_SECRET); anything else is refused before it is read.
 * The route answers 200 for updates it ignores, and 500 only when a paid order could not be fulfilled, so that
 * Telegram sends that update again.
 */
const MAX_BODY = 64 * 1024;

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function receive({ request }: { request: Request }): Promise<Response> {
  const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
  if (!secret) return new Response("webhook not configured", { status: 503 });
  if (!sameSecret(request.headers.get("x-telegram-bot-api-secret-token"), secret)) return new Response("forbidden", { status: 403 });

  const text = await request.text();
  if (text.length > MAX_BODY) return new Response("too large", { status: 413 });
  let update: unknown;
  try {
    update = JSON.parse(text);
  } catch {
    return new Response("bad request", { status: 400 });
  }
  try {
    const { handleUpdate } = await import("@/lib/stars");
    const reply = await handleUpdate(update as Parameters<typeof handleUpdate>[0]);
    return reply ? Response.json(reply) : new Response("ok");
  } catch (error) {
    console.error("[stars] webhook update failed", error);
    return new Response("error", { status: 500 });
  }
}

export const Route = createFileRoute("/api/telegram")({
  server: { handlers: { POST: receive } },
});
