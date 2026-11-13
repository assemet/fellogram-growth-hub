import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimit } from "@/lib/rate-limit";

/**
 * A fresh single-use code for the customer's QR. It lives 60 seconds in the database; the app asks for a new one
 * every 30 seconds while the QR is on screen, so a screenshot or a code read out over the phone is useless.
 */
export const issueCustomerQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await rateLimit("qr-issue", context.userId, 12, 60);
    const { data, error } = await context.supabase.rpc("issue_customer_qr");
    if (error) throw new Error(error.message);
    return { token: String(data) };
  });
