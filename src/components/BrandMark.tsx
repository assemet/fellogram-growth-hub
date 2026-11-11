import { useEffect, type ReactNode } from "react";

import { LanguageMenu } from "@/components/LanguageControls";
import { markBooted } from "@/lib/boot";
import { t } from "@/lib/i18n";

export function BrandMark() {
  return (
    <span className="font-display text-xl font-bold leading-none">{t("app.name")}</span>
  );
}

export function AppHeader({ subtitle, action }: { subtitle?: string; action?: ReactNode }) {
  useEffect(() => {
    markBooted();
  }, []);
  return (
    <header className="app-header app-shell mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-4 [padding-top:calc(1rem+env(safe-area-inset-top))]">
      <div className="flex min-w-0 items-center gap-3">
        <img src="/logo-mascot.png" alt="" width={36} height={39} className="h-10 w-auto shrink-0" decoding="async" />
        <div className="min-w-0">
          <BrandMark />
          {subtitle ? (
            <p className="mt-0.5 truncate font-display text-xl font-bold leading-tight text-foreground">{subtitle}</p>
          ) : (
            <p className="truncate text-xs text-muted-foreground">{t("app.tagline")}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <LanguageMenu />
        {action}
      </div>
    </header>
  );
}
