import { getRequest } from "@tanstack/react-start/server";

/**
 * Per-caller request limits, kept in the database so they hold across serverless instances.
 * Throws RATE_LIMITED once the allowance for the window is used up. If the limiter itself is
 * unavailable (for example the migration has not been applied yet) it lets the request through:
 * a broken counter must never lock real customers out.
 */
export async function rateLimit(bucket: string, subject: string, max: number, windowSeconds: number): Promise<void> {
  let allowed = true;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc(
      "rate_limit_hit" as never,
      { _bucket: bucket, _subject: subject, _max: max, _window_seconds: windowSeconds } as never,
    );
    if (error) console.warn(`[rate-limit] ${bucket}: ${error.message}`);
    else if ((data as unknown) === false) allowed = false;
  } catch (error) {
    console.warn(`[rate-limit] ${bucket}:`, error);
  }
  if (!allowed) throw new Error("RATE_LIMITED");
}

/** Best-effort caller address for requests that have no signed-in user yet. */
export function clientIp(): string {
  try {
    const headers = getRequest()?.headers;
    const forwarded = headers?.get("cf-connecting-ip") ?? headers?.get("x-forwarded-for") ?? headers?.get("x-real-ip") ?? "";
    return forwarded.split(",")[0]?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}
