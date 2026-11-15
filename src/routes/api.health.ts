import { createFileRoute } from "@tanstack/react-router";

/**
 * Liveness check for an uptime monitor (UptimeRobot, Better Stack, ...). Answers 200 only when the server is up
 * AND the database answers a trivial query; 503 otherwise. It returns no customer or store data. A monitor that
 * only loads the home page would miss a paused or unreachable database, which is the failure that matters most.
 */
const DATABASE_TIMEOUT_MS = 5000;

async function check(): Promise<Response> {
  const started = Date.now();
  let database = false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const probe = supabaseAdmin.from("stores").select("id").limit(1);
    const result = await Promise.race([
      probe,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), DATABASE_TIMEOUT_MS)),
    ]);
    database = !result.error;
  } catch {
    database = false;
  }
  return new Response(JSON.stringify({ ok: database, database, ms: Date.now() - started }), {
    status: database ? 200 : 503,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/health")({
  server: { handlers: { GET: check, HEAD: check } },
});
