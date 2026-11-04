import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { getLocale, t } from "@/lib/i18n";
import { disableNotifications, enableNotifications, getNotificationStatus } from "@/lib/notifications.functions";
import { requestTelegramWriteAccess } from "@/lib/telegram";

/** Bot-message opt-in, shared by the wallet prompt and the settings screen. */
export function useNotifications() {
  const queryClient = useQueryClient();
  const status = useServerFn(getNotificationStatus);
  const enable = useServerFn(enableNotifications);
  const disable = useServerFn(disableNotifications);
  const { data } = useQuery({ queryKey: ["notif-status"], queryFn: () => status(), staleTime: 60_000 });
  // True when Telegram refused delivery: the person has to open the bot chat and press Start once.
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
      setNeedsStart(false);
      toast.success(t("notify.disabledToast"));
      await queryClient.invalidateQueries({ queryKey: ["notif-status"] });
    },
    onError: () => toast.error(t("common.error")),
  });

  return { data, needsStart, enableMutation, disableMutation };
}
