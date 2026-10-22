import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { StoreScanButton } from "@/components/StoreScanButton";
import { Button } from "@/components/ui/button";
import { parseStoreCode } from "@/lib/join-code";
import { t } from "@/lib/i18n";

/** First-run wallet: three clear steps, one big scan button, and a paste fallback. */
export function WalletEmptyState() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  const steps = [t("wallet.steps.one"), t("wallet.steps.two"), t("wallet.steps.three")];

  return (
    <div className="animate-arrive rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg font-bold">{t("wallet.steps.title")}</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((text, index) => (
          <li key={text} className="flex items-start gap-3 text-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">
              {index + 1}
            </span>
            <span className="pt-1 font-medium">{text}</span>
          </li>
        ))}
      </ol>

      <StoreScanButton className="mt-6 w-full shadow-[var(--shadow-float)]" />

      <form
        className="mt-5 border-t border-border pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          const storeId = parseStoreCode(value);
          if (!storeId) {
            toast.error(t("wallet.scan.invalid"));
            return;
          }
          navigate({ to: "/join/$storeId", params: { storeId } });
        }}
      >
        <label htmlFor="storeCode" className="text-xs font-semibold text-muted-foreground">
          {t("wallet.paste.label")}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="storeCode"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t("wallet.paste.placeholder")}
            dir="ltr"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" variant="secondary" disabled={value.trim().length === 0} className="touch-action h-12 shrink-0 px-5 font-bold">
            {t("wallet.paste.action")}
          </Button>
        </div>
      </form>
    </div>
  );
}
