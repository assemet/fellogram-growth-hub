import type { ReactNode } from "react";

import { t } from "@/lib/i18n";

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt={t("app.name")}
      width={size}
      height={size}
      className="rounded-lg object-contain"
      style={{ width: size, height: size }}
    />
  );
}

export function AppHeader({ subtitle, action }: { subtitle?: string; action?: ReactNode }) {
  return (
    <header className="app-shell mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 py-3 [padding-top:calc(0.75rem+env(safe-area-inset-top))]">
      <div className="flex min-w-0 items-center gap-3">
        <BrandMark size={44} />
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-none font-bold">{t("app.name")}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle ?? t("app.tagline")}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
