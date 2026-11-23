import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import type { PlanFeature } from "@/lib/billing";
import { t, type TranslationKey } from "@/lib/i18n";

/** Shown in place of a tool the store's plan does not include. Says which feature and where to see the plans. */
export function LockedNotice({ feature, className = "" }: { feature: PlanFeature; className?: string }) {
  const name = t(`plans.feature.${feature}` as TranslationKey);
  return (
    <div className={`flex items-start gap-3 rounded-lg border border-dashed border-border bg-card/50 p-3 ${className}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
        <Lock className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{t("plans.locked.title")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("plans.locked.body", { feature: name })}</p>
        <Link to="/merchant/plans" className="touch-action mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-primary">
          {t("plans.locked.cta")}
        </Link>
      </div>
    </div>
  );
}
