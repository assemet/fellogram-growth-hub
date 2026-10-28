import { useEffect, type ReactNode } from "react";
import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { markBooted } from "@/lib/boot";
import { getLocale, setLocale, t } from "@/lib/i18n";

export function BrandMark() {
  return (
    <span className="font-display text-xl font-bold leading-none">{t("app.name")}</span>
  );
}

export function AppHeader({ subtitle, action }: { subtitle?: string; action?: ReactNode }) {
  useEffect(() => {
    markBooted();
  }, []);
  const switchLanguage = () => {
    // The root remounts the page on language change, so no reload (and no lost state/session) is needed.
    setLocale(getLocale() === "en" ? "ar" : "en");
  };
  return (
    <header className="app-header app-shell mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-4 [padding-top:calc(1rem+env(safe-area-inset-top))]">
      <div className="flex min-w-0 items-center gap-3">
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
        <Button type="button" variant="ghost" size="sm" className="touch-action gap-1 px-2 text-muted-foreground" onClick={switchLanguage} aria-label={t("language.switch")}>
          <Languages className="h-4 w-4" />
          <span className="text-xs font-bold">{getLocale() === "en" ? "AR" : "EN"}</span>
        </Button>
        {action}
      </div>
    </header>
  );
}
