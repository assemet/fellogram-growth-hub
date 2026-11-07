import { Check, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/hooks/useLanguage";
import { LOCALES, t } from "@/lib/i18n";

/** Header menu: every language written in its own script, so anyone can find theirs without reading the current one. */
export function LanguageMenu() {
  const { locale, change } = useLanguage();
  const current = LOCALES.find((item) => item.code === locale);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="touch-action gap-1 px-2 text-muted-foreground" aria-label={t("language.switch")}>
          <Languages className="h-4 w-4" />
          <span className="text-xs font-bold">{current?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {LOCALES.map((item) => (
          <DropdownMenuItem key={item.code} onSelect={() => change(item.code)} lang={item.code} dir={item.dir} className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium">
            {item.name}
            {item.code === locale && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Settings: the same choice as a list. */
export function LanguagePicker() {
  const { locale, change } = useLanguage();
  return (
    <div role="radiogroup" aria-label={t("settings.language")} className="space-y-1.5">
      {LOCALES.map((item) => {
        const active = item.code === locale;
        return (
          <button
            key={item.code}
            type="button"
            role="radio"
            aria-checked={active}
            lang={item.code}
            dir={item.dir}
            onClick={() => change(item.code)}
            className={`touch-action flex min-h-12 w-full items-center justify-between gap-3 rounded-md border px-4 text-sm font-semibold transition-colors ${
              active ? "border-primary bg-accent text-foreground" : "border-border bg-background text-muted-foreground"
            }`}
          >
            {item.name}
            {active && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
