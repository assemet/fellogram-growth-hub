import { supabase } from "@/integrations/supabase/client";
import { telegramSignIn } from "@/lib/auth.functions";
import { getInitData } from "@/lib/telegram";
import { resetAuthCache } from "@/hooks/useFellogramAuth";

/** The server refused the session token (expired, revoked, or the account behind it no longer exists). */
export function isUnauthorizedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /unauthorized/i.test(message);
}

let healing: Promise<boolean> | null = null;

/**
 * A stored session the server no longer accepts is never fixed by retrying: the app believes it is signed in
 * and keeps sending the same dead token. Drop it and sign in again from Telegram's launch data.
 * Shared between callers so several failing requests trigger one sign-in.
 */
export function healSession(): Promise<boolean> {
  if (healing) return healing;
  healing = (async () => {
    try {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      resetAuthCache();
      const result = await telegramSignIn({ data: { initData: getInitData() } });
      const { error } = await supabase.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
      return !error;
    } catch (error) {
      console.error("Session recovery failed", error);
      return false;
    } finally {
      // Allow another attempt later, but not within the same burst of failing requests.
      setTimeout(() => {
        healing = null;
      }, 5000);
    }
  })();
  return healing;
}
