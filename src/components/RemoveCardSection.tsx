import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { leaveStore } from "@/lib/privacy.functions";

/** A customer removes their own card for one store. Two taps, and the cost (lost stamps) is spelled out. */
export function RemoveCardSection({ storeId, storeName, balance }: { storeId: string; storeName: string; balance: number }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const remove = useServerFn(leaveStore);
  const [confirming, setConfirming] = useState(false);

  // The "tap again" step lapses on its own so a stray tap never removes the card later.
  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(id);
  }, [confirming]);

  const mutation = useMutation({
    mutationFn: () => remove({ data: { storeId } }),
    onSuccess: async () => {
      toast.success(t("wallet.removed"));
      await queryClient.invalidateQueries({ queryKey: ["my-cards"] });
      void navigate({ to: "/wallet", replace: true });
    },
    onError: () => {
      setConfirming(false);
      toast.error(t("common.error"));
    },
  });

  return (
    <div className="mt-8 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-bold">{t("wallet.remove.title")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("wallet.remove.body", { count: balance, store: storeName })}</p>
      <Button
        type="button"
        variant={confirming ? "destructive" : "outline"}
        disabled={mutation.isPending}
        className="touch-action mt-3 h-11 w-full font-semibold"
        onClick={() => (confirming ? mutation.mutate() : setConfirming(true))}
      >
        {confirming ? t("team.confirmRemove") : t("wallet.remove.action")}
      </Button>
    </div>
  );
}
