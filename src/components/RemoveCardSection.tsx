import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isDeleteWord, normalizeWord } from "@/lib/confirm-words";
import { t } from "@/lib/i18n";
import { leaveStore } from "@/lib/privacy.functions";

/** Cards holding at least this many stamps ask for a typed confirmation, so a card worth keeping is never lost to a stray tap. */
export const TYPED_CONFIRM_FROM_STAMPS = 3;

/** A customer removes their own card for one store. A confirmation window spells out the loss; rich cards also ask to type a word. */
export function RemoveCardSection({ storeId, storeName, balance }: { storeId: string; storeName: string; balance: number }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const remove = useServerFn(leaveStore);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const needsTyping = balance >= TYPED_CONFIRM_FROM_STAMPS;
  const confirmed = !needsTyping || isDeleteWord(typed) || (normalizeWord(typed) !== "" && normalizeWord(typed) === normalizeWord(storeName));
  const keepRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setTyped("");
  };

  const mutation = useMutation({
    mutationFn: () => remove({ data: { storeId } }),
    onSuccess: async () => {
      toast.success(t("wallet.removed"));
      await queryClient.invalidateQueries({ queryKey: ["my-cards"] });
      void navigate({ to: "/wallet", replace: true });
    },
    onError: () => {
      close();
      toast.error(t("common.error"));
    },
  });

  // The safe choice has the focus, and Escape closes the window.
  useEffect(() => {
    if (!open) return;
    keepRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !mutation.isPending) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mutation.isPending]);

  return (
    <div className="mt-8 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-bold">{t("wallet.remove.title")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("wallet.remove.body", { count: balance, store: storeName })}</p>
      <Button type="button" variant="outline" className="touch-action mt-3 h-11 w-full font-semibold" onClick={() => setOpen(true)}>
        {t("wallet.remove.action")}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4 sm:items-center"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="remove-card-title"
          onClick={() => !mutation.isPending && close()}
        >
          <div
            className="animate-arrive w-full max-w-sm rounded-lg border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-float)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="remove-card-title" className="font-display text-lg font-bold">
              {t("wallet.remove.dialogTitle", { store: storeName })}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t("wallet.remove.confirmBody", { count: balance, store: storeName })}</p>

            {needsTyping && (
              <label className="mt-4 block text-sm font-medium">
                {t("wallet.remove.typeLabel", { word: t("settings.delete.word"), store: storeName })}
                <Input
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  dir="auto"
                  className="mt-2 h-11"
                />
              </label>
            )}

            <div className="mt-5 grid gap-2">
              <Button ref={keepRef} type="button" className="touch-action h-12 w-full font-semibold" onClick={close} disabled={mutation.isPending}>
                {t("wallet.remove.keep")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="touch-action h-11 w-full font-semibold"
                onClick={() => mutation.mutate()}
                disabled={!confirmed || mutation.isPending}
              >
                {t("wallet.remove.action")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
