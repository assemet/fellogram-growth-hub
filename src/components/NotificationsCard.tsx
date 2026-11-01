import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getLocale, t } from "@/lib/i18n";
import { disableNotifications, enableNotifications, getNotificationStatus } from "@/lib/notifications.functions";
import { requestTelegramWriteAccess } from "@/lib/telegram";

const DISMISS_KEY = "fellogram.notify.dismissedAt";
const DISMISS_DAYS = 14;

function recentlyDismissed(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}

/**
 * Opt-in for bot messages (stamp added, reward ready). Asked after the customer already has a card,
 * which is when it makes sense to them; "Not now" is remembered for two weeks.
 */
export function NotificationsCard() {
  const queryClient = useQueryClient();
  const status = useServerFn(getNotificationStatus);
  const enable = useServerFn(enableNotifications);
  const disable = useServerFn(disableNotifications);
  const { data } = useQuery({ queryKey: ["notif-status"], queryFn: () => status(), staleTime: 60_000 });
  const [dismissed, setDismissed] = useState(recentlyDismissed);
  const [needsStart, setNeedsStart] = useState(false);

  const enableMutation = useMutation({
    mutationFn: async () => {
      // Telegram's own "allow this bot to message you" prompt; the server then proves it by delivering a message.
      await requestTelegramWriteAccess();
      return enable({ data: { locale: getLocale() } });
    },
    onSuccess: async (result) => {
      if (result.ok) {
        setNeedsStart(false);
        toast.success(t("notify.enabledToast"));
        await queryClient.invalidateQueries({ queryKey: ["notif-status"] });
      } else if (result.reason === "blocked") {
        setNeedsStart(true);
      } else {
        toast.error(result.reason === "migration" ? t("notify.migration") : t("notify.failed"));
      }
    },
    onError: () => toast.error(t("notify.failed")),
  });

  const disableMutation = useMutation({
    mutationFn: () => disable(),
    onSuccess: async () => {
      toast.success(t("notify.disabledToast"));
      await queryClient.invalidateQueries({ queryKey: ["notif-status"] });
    },
    onError: () => toast.error(t("common.error")),
  });

  if (!data || !data.supported) return null;

  if (data.enabled) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-[var(--shadow-card)]">
        <Bell className="h-4 w-4 shrink-0 text-growth" aria-hidden="true" />
        <span className="min-w-0 flex-1 font-semibold">{t("notify.on")}</span>
        <Button type="button" variant="ghost" size="sm" disabled={disableMutation.isPending} className="touch-action h-10 shrink-0 gap-1 px-3 text-xs font-semibold" onClick={() => disableMutation.mutate()}>
          <BellOff className="h-3.5 w-3.5" />
          {t("notify.turnOff")}
        </Button>
      </div>
    );
  }

  if (dismissed && !needsStart) return null;

  return (
    <div className="animate-arrive rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden="true">
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">{t("notify.card.title")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("notify.card.body")}</p>
        </div>
      </div>

      {needsStart && (
        <p role="alert" className="mt-3 rounded-md bg-muted px-3 py-2 text-xs font-semibold">
          {t("notify.blocked")}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {needsStart ? (
          <Button asChild variant="outline" className="touch-action h-12 font-semibold">
            <a href={`https://t.me/${data.bot}`}>{t("notify.openBot")}</a>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="touch-action h-12 font-semibold"
            onClick={() => {
              try {
                window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
              } catch {
                /* the card simply returns next visit */
              }
              setDismissed(true);
            }}
          >
            {t("notify.card.later")}
          </Button>
        )}
        <Button type="button" disabled={enableMutation.isPending} className="touch-action h-12 font-bold" onClick={() => enableMutation.mutate()}>
          {needsStart ? t("wallet.error.retry") : t("notify.card.enable")}
        </Button>
      </div>
    </div>
  );
}
