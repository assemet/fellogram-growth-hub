import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { getReminderSummary, sendReminders } from "@/lib/notifications.functions";

/** Owner tool on the customers page: one friendly reminder to customers who went quiet. */
export function ReminderCard({ ready }: { ready: boolean }) {
  const queryClient = useQueryClient();
  const load = useServerFn(getReminderSummary);
  const send = useServerFn(sendReminders);
  const [confirming, setConfirming] = useState(false);

  const { data } = useQuery({ queryKey: ["reminder-summary"], queryFn: () => load(), enabled: ready, staleTime: 30_000 });

  // The "tap again" step lapses on its own so a stray tap never sends later.
  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(id);
  }, [confirming]);

  const mutation = useMutation({
    mutationFn: () => send(),
    onSuccess: async (result) => {
      setConfirming(false);
      toast.success(t("reminder.sent", { count: result.sent }));
      if (result.remaining > 0) toast.message(t("reminder.more", { count: result.remaining }));
      await queryClient.invalidateQueries({ queryKey: ["reminder-summary"] });
    },
    onError: () => {
      setConfirming(false);
      toast.error(t("common.error"));
    },
  });

  if (!data || data.inactive === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden="true">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">{t("reminder.title")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("reminder.body", { inactive: data.inactive, days: data.days, reachable: data.reachable })}</p>
        </div>
      </div>
      {data.reachable > 0 ? (
        <>
          <Button
            type="button"
            variant={confirming ? "default" : "outline"}
            disabled={mutation.isPending}
            className="touch-action mt-3 h-12 w-full font-bold"
            onClick={() => (confirming ? mutation.mutate() : setConfirming(true))}
          >
            {mutation.isPending ? t("reminder.sending") : confirming ? t("reminder.confirm") : t("reminder.send", { count: Math.min(data.reachable, data.perSend) })}
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">{t("reminder.limit")}</p>
        </>
      ) : (
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t("reminder.none")}</p>
      )}
    </div>
  );
}
