import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { telegramSignIn } from "@/lib/auth.functions";
import { getInitData, getTelegramLanguage, initTelegram, rememberStartParam, watchTelegramTheme } from "@/lib/telegram";
import { initializeLocale } from "@/lib/i18n";

export type AuthState = "loading" | "ready" | "error";

/**
 * Ensures a Telegram-backed session exists. Runs once per app load: the raw
 * initData goes to the server, the server returns a normal user session.
 */
export function useFellogramAuth() {
  const signIn = useServerFn(telegramSignIn);
  const [state, setState] = useState<AuthState>("loading");
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unwatchTheme = watchTelegramTheme();

    (async () => {
      try {
        initTelegram();
        initializeLocale(getTelegramLanguage());
        rememberStartParam();

        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (!cancelled) setState("ready");
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
        console.error("Fellogram sign-in failed", error);
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      unwatchTheme();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, previewMode };
}
