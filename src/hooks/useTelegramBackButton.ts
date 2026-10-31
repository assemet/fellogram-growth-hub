import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

import { backTarget } from "@/lib/back-target";
import { setTelegramBackButton } from "@/lib/telegram";

/** Shows Telegram's native Back button on inner screens and sends it to the screen's parent. */
export function useTelegramBackButton() {
  const location = useRouterState({ select: (state) => state.location });
  const navigate = useNavigate();
  const target = backTarget(location.pathname, location.search as Record<string, unknown>);

  useEffect(() => {
    if (!target) {
      setTelegramBackButton(null);
      return;
    }
    setTelegramBackButton(() => {
      void navigate({ to: target });
    });
    return () => setTelegramBackButton(null);
  }, [target, navigate]);
}
