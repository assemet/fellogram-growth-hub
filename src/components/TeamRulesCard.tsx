import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";
import { updateTeamRules } from "@/lib/team.functions";

type Rules = { supported: boolean; canUndo: boolean; dailyLimit: number };

/** Owner-set limits for cashiers: whether they can undo a stamp, and a rolling 24-hour stamp cap. */
export function TeamRulesCard({ rules }: { rules: Rules }) {
  const queryClient = useQueryClient();
  const save = useServerFn(updateTeamRules);
  const [canUndo, setCanUndo] = useState(rules.canUndo);
  const [limitText, setLimitText] = useState(String(rules.dailyLimit));

  const dailyLimit = Math.min(1000, Math.max(0, Math.round(Number(limitText)) || 0));
  const dirty = canUndo !== rules.canUndo || dailyLimit !== rules.dailyLimit;

  const mutation = useMutation({
    mutationFn: () => save({ data: { canUndo, dailyLimit } }),
    onSuccess: async () => {
      toast.success(t("team.rules.saved"));
      await queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("DB_MIGRATION_REQUIRED") ? t("error.migrationNeeded") : t("common.error")),
  });

  return (
    <div className="mt-8 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-bold">{t("team.rules.title")}</h2>
      {!rules.supported ? (
        <p className="mt-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t("error.migrationNeeded")}</p>
      ) : (
        <div className="mt-3 space-y-4">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <label htmlFor="teamCanUndo" className="min-w-0 text-sm font-medium">
              {t("team.rules.canUndo")}
            </label>
            <Switch id="teamCanUndo" checked={canUndo} onCheckedChange={setCanUndo} />
          </div>
          <div>
            <label htmlFor="teamDailyLimit" className="text-sm font-medium">
              {t("team.rules.dailyLimit")}
            </label>
            <input
              id="teamDailyLimit"
              type="number"
              inputMode="numeric"
              min={0}
              max={1000}
              value={limitText}
              onChange={(event) => setLimitText(event.target.value)}
              className="mt-1 w-28 rounded-md border border-border bg-background px-4 py-3 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("team.rules.dailyLimit.hint")}</p>
          </div>
          <Button type="button" disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()} className="touch-action h-11 w-full font-bold">
            {mutation.isPending ? t("program.saving") : t("team.rules.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
