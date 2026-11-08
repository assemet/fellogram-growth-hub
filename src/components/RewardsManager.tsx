import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { t } from "@/lib/i18n";
import { isValidTier, mainRewardId } from "@/lib/rewards";
import { archiveReward, saveReward } from "@/lib/store.functions";
import { Button } from "@/components/ui/button";

type Reward = { id: string; name: string; description: string | null; stamps_required: number; active: boolean; created_at?: string | null };

/**
 * Extra reward tiers (the main reward is edited in the program form above). A tier must need fewer stamps
 * than the card: one that needs as many, or more, can never be earned on the way, so customers never see it.
 */
export function RewardsManager({ rewards, cardStamps }: { rewards: Reward[]; cardStamps: number }) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveReward);
  const archive = useServerFn(archiveReward);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const maxTier = cardStamps - 1;
  const [stamps, setStamps] = useState(String(Math.max(1, Math.min(5, maxTier))));

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["my-store"] });
    await queryClient.invalidateQueries({ queryKey: ["my-cards"] });
  };

  const add = useMutation({
    mutationFn: () => save({ data: { name, description, stampsRequired: Number(stamps) || 5 } }),
    onSuccess: async () => {
      setName("");
      setDescription("");
      toast.success(t("program.saved"));
      await refresh();
    },
    onError: (e: Error) => toast.error(e.message.includes("TIER_TOO_HIGH") ? t("rewards.tierTooHigh") : t("common.error")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => archive({ data: { id } }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message.includes("CANNOT_ARCHIVE_MAIN") ? t("rewards.mainLocked") : t("common.error")),
  });

  const active = rewards.filter((r) => r.active).sort((a, b) => a.stamps_required - b.stamps_required);
  const mainId = mainRewardId(active, cardStamps);
  const stampsNumber = Math.round(Number(stamps)) || 0;
  const tierOk = isValidTier(stampsNumber, cardStamps) && stampsNumber >= 1;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-bold">{t("rewards.manage")}</h2>
      <p className="text-sm text-muted-foreground">{t("rewards.manageSub")}</p>

      <ul className="mt-3 space-y-2">
        {active.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 rounded-md bg-secondary px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-secondary-foreground">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.stamps_required} {t("rewards.stamps").toLowerCase()}
                {r.id === mainId && ` · ${t("rewards.main")}`}
              </p>
              {r.id !== mainId && !isValidTier(r.stamps_required, cardStamps) && (
                <p className="mt-1 text-xs font-semibold text-destructive">
                  {t("rewards.hidden")} — {t("rewards.hiddenWhy")}
                </p>
              )}
            </div>
            {r.id !== mainId && (
              <Button
                type="button"
                aria-label={t("rewards.remove")}
                onClick={() => remove.mutate(r.id)}
                variant="ghost" size="icon" className="touch-action shrink-0 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <form
        className="mt-4 space-y-2 border-t border-border pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length < 2) {
            toast.error(t("common.error"));
            return;
          }
          if (!tierOk) {
            toast.error(t("rewards.tierTooHigh"));
            return;
          }
          add.mutate();
        }}
      >
        <div className="flex gap-2">
          <input
            aria-label={t("rewards.name")}
            placeholder={t("rewards.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            aria-label={t("rewards.stamps")}
            type="number"
            min={1}
            max={Math.max(1, maxTier)}
            value={stamps}
            onChange={(e) => setStamps(e.target.value)}
            className="w-20 rounded-md border border-border bg-background px-3 py-3 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <input
          aria-label={t("rewards.description")}
          placeholder={t("rewards.description")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <p className={`text-xs ${tierOk || maxTier < 1 ? "text-muted-foreground" : "font-semibold text-destructive"}`}>
          {maxTier < 1 ? t("rewards.tierNone") : t("rewards.tierHint", { count: cardStamps })}
        </p>
        <Button
          type="submit"
          disabled={add.isPending || maxTier < 1}
          variant="secondary" className="touch-action h-12 w-full font-semibold"
        >
          {t("rewards.add")}
        </Button>
      </form>
    </div>
  );
}
