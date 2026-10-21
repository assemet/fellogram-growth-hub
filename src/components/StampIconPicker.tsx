import { useMemo, useState } from "react";
import { ImageIcon, Search } from "lucide-react";

import { StampIcon } from "@/components/StampIcon";
import { t, type TranslationKey } from "@/lib/i18n";
import { categoryOfIcon, STAMP_LOGO_ID, stampIconCategories, stampIconIds, type StampIconCategoryId } from "@/lib/stamp-icons";

const iconName = (id: string) => t(`stampIcon.${id}` as TranslationKey);

/** Category chips + search + icon grid, plus "use my logo" as the stamp. */
export function StampIconPicker({
  value,
  onChange,
  logoUrl,
}: {
  value: string;
  onChange: (id: string) => void;
  logoUrl: string | null;
}) {
  const [category, setCategory] = useState<StampIconCategoryId>(() => categoryOfIcon(value));
  const [query, setQuery] = useState("");

  const visible = useMemo<readonly string[]>(() => {
    const needle = query.trim().toLowerCase();
    if (needle) return stampIconIds.filter((id) => id.includes(needle) || iconName(id).toLowerCase().includes(needle));
    return stampIconCategories.find((entry) => entry.id === category)?.icons ?? [];
  }, [category, query]);

  const logoSelected = value === STAMP_LOGO_ID;

  return (
    <div className="mt-3 space-y-3">
      <button
        type="button"
        disabled={!logoUrl}
        aria-pressed={logoSelected}
        onClick={() => onChange(STAMP_LOGO_ID)}
        className="theme-choice touch-action flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-start text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-muted-foreground">
          {logoUrl ? <StampIcon name={STAMP_LOGO_ID} logoUrl={logoUrl} className="h-full w-full" /> : <ImageIcon className="h-4 w-4" />}
        </span>
        <span className="min-w-0">
          <span className="block">{t("program.useLogo")}</span>
          {!logoUrl && <span className="block text-xs font-normal text-muted-foreground">{t("program.useLogoHint")}</span>}
        </span>
      </button>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Enter in the search box must not submit the surrounding settings form.
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder={t("program.iconSearch")}
          aria-label={t("program.iconSearch")}
          className="w-full rounded-md border border-border bg-card py-3 ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {!query.trim() && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label={t("program.stampIcon")}>
          {stampIconCategories.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={category === entry.id}
              onClick={() => setCategory(entry.id)}
              className={`touch-action shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold ${
                category === entry.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
              }`}
            >
              {t(`program.iconCategory.${entry.id}` as TranslationKey)}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t("program.iconNone")}</p>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {visible.map((id) => (
            <button
              key={id}
              type="button"
              title={iconName(id)}
              aria-label={iconName(id)}
              aria-pressed={value === id}
              onClick={() => onChange(id)}
              className={`theme-choice touch-action flex h-14 items-center justify-center rounded-md border ${
                value === id ? "!border-primary !bg-primary !text-primary-foreground" : ""
              }`}
            >
              <StampIcon name={id} className="h-6 w-6" />
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {t("program.iconSelected", { name: logoSelected ? t("stampIcon.logo") : iconName(value) })}
      </p>
    </div>
  );
}
