import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { t } from "@/lib/i18n";
import { archiveReward, saveReward } from "@/lib/store.functions";

type Reward = { id: string; name: string; description: string | null; stamps_required: number; active: boolean };

/** Extra reward tiers (the main reward is edited in the program form above). */
export function RewardsManager({ rewards }: { rewards: Reward[] }) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveReward);
  const archive = useServerFn(archiveReward);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stamps, setStamps] = useState("5");

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
    onError: () => toast.error(t("common.error")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => archive({ data: { id } }),
    onSuccess: refresh,
    onError: () => toast.error(t("common.error")),
  });

  const active = rewards.filter((r) => r.active).sort((a, b) => a.stamps_required - b.stamps_required);

  return (
    <div className="mt-8 rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-lg font-bold">{t("rewards.manage")}</h2>
      <p className="text-sm text-muted-foreground">{t("rewards.manageSub")}</p>

      <ul className="mt-3 space-y-2">
        {active.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-secondary-foreground">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.stamps_required} {t("rewards.stamps").toLowerCase()}
              </p>
            </div>
            {active.length > 1 && (
              <button
                type="button"
                aria-label={t("rewards.remove")}
                onClick={() => remove.mutate(r.id)}
                className="rounded-full p-2 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
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
          add.mutate();
        }}
      >
        <div className="flex gap-2">
          <input
            aria-label={t("rewards.name")}
            placeholder={t("rewards.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <input
            aria-label={t("rewards.stamps")}
            type="number"
            min={1}
            max={50}
            value={stamps}
            onChange={(e) => setStamps(e.target.value)}
            className="w-20 rounded-2xl border border-border bg-background px-3 py-3 text-center text-sm outline-none focus:border-primary"
          />
        </div>
        <input
          aria-label={t("rewards.description")}
          placeholder={t("rewards.description")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={add.isPending}
          className="w-full rounded-full bg-secondary py-3 text-sm font-semibold text-secondary-foreground disabled:opacity-60"
        >
          {t("rewards.add")}
        </button>
      </form>
    </div>
  );
}
