import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { resetAuthCache } from "@/hooks/useFellogramAuth";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";
import { deleteMyAccount, leaveTeam } from "@/lib/privacy.functions";

const CONFIRM_WORDS = ["delete", "حذف"];

/** A cashier stops working for their store (two taps). */
export function LeaveTeamRow({ storeName }: { storeName: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const leave = useServerFn(leaveTeam);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(id);
  }, [confirming]);

  const mutation = useMutation({
    mutationFn: () => leave(),
    onSuccess: async () => {
      toast.success(t("settings.leftTeam"));
      await queryClient.invalidateQueries({ queryKey: ["my-context"] });
      void navigate({ to: "/wallet", replace: true });
    },
    onError: () => {
      setConfirming(false);
      toast.error(t("common.error"));
    },
  });

  return (
    <div>
      <p className="text-xs text-muted-foreground">{t("settings.leaveTeam.hint")}</p>
      <Button
        type="button"
        variant={confirming ? "destructive" : "outline"}
        disabled={mutation.isPending}
        className="touch-action mt-2 h-11 w-full font-semibold"
        onClick={() => (confirming ? mutation.mutate() : setConfirming(true))}
      >
        {confirming ? t("team.confirmRemove") : t("settings.leaveTeam", { store: storeName })}
      </Button>
    </div>
  );
}

/** Delete my account and data. Owners are told to delete their store first (the server refuses too). */
export function DeleteAccountSection({ isOwner }: { isOwner: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const remove = useServerFn(deleteMyAccount);
  const [typed, setTyped] = useState("");
  const confirmed = CONFIRM_WORDS.includes(typed.trim().toLowerCase());

  const mutation = useMutation({
    mutationFn: () => remove({ data: { confirm: typed } }),
    onSuccess: async () => {
      // The account no longer exists: drop the local session and everything cached, then start over.
      await supabase.auth.signOut({ scope: "local" });
      resetAuthCache();
      queryClient.clear();
      toast.success(t("settings.deleted"));
      void navigate({ to: "/", replace: true });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("OWNS_STORE") ? t("settings.delete.owner") : e.message.includes("PREVIEW_ACCOUNT") ? t("settings.delete.preview") : t("common.error"),
      ),
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("settings.delete.body")}</p>
      {isOwner ? (
        <p role="note" className="rounded-md bg-muted px-3 py-2 text-xs font-semibold">
          {t("settings.delete.owner")}
        </p>
      ) : (
        <>
          <label htmlFor="deleteConfirm" className="block text-xs font-semibold text-muted-foreground">
            {t("settings.delete.confirmLabel", { word: t("settings.delete.word") })}
          </label>
          <input
            id="deleteConfirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-destructive"
          />
          <Button
            type="button"
            variant="destructive"
            disabled={!confirmed || mutation.isPending}
            className="touch-action h-11 w-full font-semibold"
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? t("settings.delete.deleting") : t("settings.delete.action")}
          </Button>
        </>
      )}
    </div>
  );
}
