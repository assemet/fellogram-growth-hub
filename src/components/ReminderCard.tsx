import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing } from "lucide-react";
import { toast } from "sonner";

import { LockedNotice } from "@/components/LockedNotice";
import { Button } from "@/components/ui/button";
import { isLocked, useMyPlan } from "@/hooks/useMyPlan";
import { t } from "@/lib/i18n";
import { getReminderSummary, getRewardReminderSummary, sendReminders, sendRewardReminders } from "@/lib/notifications.functions";

/** Owner tool on the customers page: one friendly reminder to customers who went quiet. */
export function ReminderCard({ ready, kind = "inactive" }: { ready: boolean; kind?: "inactive" | "reward" }) {
  const reward = kind === "reward";
  const queryClient = useQueryClient();
  const load = useServerFn(reward ? getRewardReminderSummary : getReminderSummary);
  const send = useServerFn(reward ? sendRewardReminders : sendReminders);
  const [confirming, setConfirming] = useState(false);
  const { plan } = useMyPlan();
  const locked = isLocked(plan, "reminders");

  const { data } = useQuery({ queryKey: ["reminder-summary", kind], queryFn: async () => {
      const result = await load();
      return { count: "waiting" in result ? result.waiting : result.inactive, days: result.days, reachable: result.reachable, perSend: result.perSend };
    }, enabled: ready && !locked, staleTime: 30_000 });

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
      await queryClient.invalidateQueries({ queryKey: ["reminder-summary", kind] });
    },
    onError: () => {
      setConfirming(false);
      toast.error(t("common.error"));
    },
  });

  // One notice for both reminder cards, shown by the first.
  if (locked) return reward ? null : <LockedNotice feature="reminders" className="mb-4" />;
  if (!data) return null;
  const count = data.count;

  // Nobody to remind: still say so, so the owner knows the feature exists and why there is no button.
  if (count === 0) {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-dashed border-border bg-card/50 p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
          <BellRing className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{reward ? t("reminder.reward.title") : t("reminder.title")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{reward ? t("reminder.reward.empty", { days: data.days }) : t("reminder.empty", { days: data.days })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden="true">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">{reward ? t("reminder.reward.title") : t("reminder.title")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{reward ? t("reminder.reward.body", { count, days: data.days, reachable: data.reachable }) : t("reminder.body", { inactive: count, days: data.days, reachable: data.reachable })}</p>
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
          <p className="mt-2 text-[0.6875rem] text-muted-foreground">{reward ? t("reminder.reward.limit") : t("reminder.limit")}</p>
        </>
      ) : (
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t("reminder.none")}</p>
      )}
    </div>
  );
}
