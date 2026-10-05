import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { telegramSignIn } from "@/lib/auth.functions";
import {
  getInitData,
  getTelegramLanguage,
  getUnsafeTelegramUserId,
  initTelegram,
  rememberStartParam,
  watchTelegramTheme,
} from "@/lib/telegram";
import { initializeLocale } from "@/lib/i18n";

export type AuthState = "loading" | "ready";

const DEMO_TELEGRAM_ID = 100000001;

/**
 * Ensures a session exists without ever showing an error screen. Inside
 * Telegram the signed launch data is verified server-side; elsewhere the
 * shared demo account is used. Transient failures retry automatically.
 */
export function useFellogramAuth() {
  const signIn = useServerFn(telegramSignIn);
  const [state, setState] = useState<AuthState>("loading");
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    initTelegram();
    const unwatchTheme = watchTelegramTheme();
    initializeLocale(getTelegramLanguage());
    rememberStartParam();

    const attempt = async (tries: number): Promise<void> => {
      try {
        const launchUserId = getUnsafeTelegramUserId();
        const { data } = await supabase.auth.getSession();
        const sessionTgId = Number(data.session?.user.user_metadata?.['telegram_user_id'] ?? NaN);
        // Reuse the session unless Telegram launched us as a different person
        // (e.g. a leftover demo session inside the Telegram app).
        const sessionMatches =
          data.session && (launchUserId === null || sessionTgId === launchUserId);
        if (sessionMatches) {
          if (!cancelled) {
            setPreviewMode(sessionTgId === DEMO_TELEGRAM_ID);
            setState("ready");
          }
          return;
        }

        const result = await signIn({ data: { initData: getInitData() } });
        const { error } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
        if (error) throw error;
        if (!cancelled) {
          setPreviewMode(result.previewMode);
          setState("ready");
        }
      } catch (error) {
        console.error("Fellogram sign-in failed, retrying", error);
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, Math.min(4000, 800 * (tries + 1))));
        if (!cancelled) return attempt(tries + 1);
      }
    };
    void attempt(0);

    return () => {
      cancelled = true;
      unwatchTheme();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, previewMode };
}
