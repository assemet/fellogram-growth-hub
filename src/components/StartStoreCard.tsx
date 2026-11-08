import { Link } from "@tanstack/react-router";
import { Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** The way in for someone who owns a business: shown to people who have no store yet, where they will actually look. */
export function StartStoreCard({ className = "" }: { className?: string }) {
  return (
    <section className={`rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)] ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden="true">
          <Store className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-snug">{t("wallet.merchantCta.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("wallet.merchantCta.hint")}</p>
        </div>
      </div>
      <Button asChild className="touch-action mt-3 h-12 w-full font-bold">
        <Link to="/merchant/new">{t("wallet.merchantCta.action")}</Link>
      </Button>
    </section>
  );
}
