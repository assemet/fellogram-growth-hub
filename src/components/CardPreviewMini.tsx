import { Building2, Gift } from "lucide-react";

import { StampIcon } from "@/components/StampIcon";
import { brandThemeStyle, resolveCardTheme, type BrandColors } from "@/lib/card-theme";
import { t } from "@/lib/i18n";

/**
 * Compact live preview that stays pinned while the owner edits. It reuses the real
 * card theme classes so colors match exactly, but shows only what the settings change:
 * logo, name, colors, icon, stamp count and reward.
 */
export function CardPreviewMini({
  storeName,
  programName,
  logoUrl,
  stampIcon,
  cardTheme,
  colors,
  stampsRequired,
  rewardName,
}: {
  storeName: string;
  programName: string;
  logoUrl: string | null;
  stampIcon: string;
  cardTheme: string;
  colors: BrandColors;
  stampsRequired: number;
  rewardName: string;
}) {
  const shown = Math.min(5, stampsRequired);
  const filled = Math.min(2, shown);
  return (
    <div
      data-card-theme={resolveCardTheme(cardTheme)}
      data-custom-brand="true"
      style={brandThemeStyle(cardTheme, colors)}
      className="loyalty-card overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]"
    >
      <div className="loyalty-card-header brand-surface flex items-center gap-3 px-4 py-3" style={{ minHeight: 0 }}>
        <div className="store-avatar flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-current/20 bg-card/15" aria-hidden="true">
          {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold leading-tight">{storeName}</p>
          <p className="truncate text-xs font-medium opacity-90">{programName || "—"}</p>
        </div>
        <span className="shrink-0 rounded-md border border-current/20 bg-card/15 px-2.5 py-1 text-xs font-extrabold">
          {filled}/{stampsRequired}
        </span>
      </div>
      <div className="loyalty-card-body flex items-center gap-3 px-4 py-3">
        <div className="flex flex-1 items-center gap-1.5">
          {Array.from({ length: shown }).map((_, index) => {
            const on = index < filled;
            return (
              <div
                key={index}
                className={
                  on
                    ? "loyalty-stamp-filled flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/25 bg-primary text-primary-foreground"
                    : "loyalty-stamp-empty flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-secondary/40 text-muted-foreground"
                }
              >
                {stampIcon === "logo" && logoUrl ? (
                  <StampIcon name="logo" logoUrl={logoUrl} dim={!on} className="h-full w-full" />
                ) : (
                  <StampIcon name={stampIcon} className={on ? "h-4 w-4" : "h-3.5 w-3.5 opacity-35"} />
                )}
              </div>
            );
          })}
          {stampsRequired > shown && <span className="ps-1 text-xs font-semibold text-muted-foreground">+{stampsRequired - shown}</span>}
        </div>
        {rewardName && (
          <p className="flex min-w-0 max-w-[45%] items-center gap-1.5 text-xs font-semibold">
            <Gift className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{rewardName}</span>
          </p>
        )}
      </div>
    </div>
  );
}
