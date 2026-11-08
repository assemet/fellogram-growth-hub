import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { t } from "@/lib/i18n";
import { updateReferralSettings } from "@/lib/store.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type Program = { referrals_enabled: boolean; referrer_bonus_stamps: number; welcome_bonus_stamps: number } | null;

/** Owner-side referral rules: on/off + bonus stamps for each side. */
export function ReferralSettings({ program }: { program: Program }) {
  const queryClient = useQueryClient();
  const save = useServerFn(updateReferralSettings);
  const [enabled, setEnabled] = useState(true);
  const [referrer, setReferrer] = useState("2");
  const [welcome, setWelcome] = useState("1");

  useEffect(() => {
    if (!program) return;
    setEnabled(program.referrals_enabled);
    setReferrer(String(program.referrer_bonus_stamps));
    setWelcome(String(program.welcome_bonus_stamps));
  }, [program]);

  const mutation = useMutation({
    mutationFn: () =>
      save({ data: { enabled, referrerBonus: Number(referrer), welcomeBonus: Number(welcome) } }),
    onSuccess: async () => {
      toast.success(t("program.saved"));
      await queryClient.invalidateQueries({ queryKey: ["my-store"] });
      await queryClient.invalidateQueries({ queryKey: ["my-cards"] });
    },
    onError: () => toast.error(t("common.error")),
  });

  const field = "w-20 rounded-md border border-border bg-background px-3 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-bold">{t("referral.settings")}</h2>
      <p className="text-sm text-muted-foreground">{t("referral.settingsSub")}</p>

      <div className="mt-4 flex min-h-11 items-center justify-between gap-3">
        <label htmlFor="referralsEnabled" className="min-w-0 text-sm font-semibold">
          {t("referral.enabled")}
        </label>
        <Switch id="referralsEnabled" checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <label className="mt-3 flex items-center justify-between gap-3 text-sm">
        {t("referral.referrerBonus")}
        <input type="number" min={0} max={20} value={referrer} onChange={(e) => setReferrer(e.target.value)} disabled={!enabled} className={field} />
      </label>
      <label className="mt-3 flex items-center justify-between gap-3 text-sm">
        {t("referral.welcomeBonus")}
        <input type="number" min={0} max={20} value={welcome} onChange={(e) => setWelcome(e.target.value)} disabled={!enabled} className={field} />
      </label>

      <Button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        variant="secondary" className="touch-action mt-4 h-12 w-full font-semibold"
      >
        {t("referral.save")}
      </Button>
    </div>
  );
}
