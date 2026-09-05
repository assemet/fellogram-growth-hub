import { useState } from "react";
import { Check, ChevronDown, Gift, Stamp } from "lucide-react";

import { t } from "@/lib/i18n";

export type StampCardData = {
  id: string;
  storeName: string;
  programName: string;
  stampsRequired: number;
  stampBalance: number;
  reward: string | null;
  lastVisitAt: string | null;
  visits: { id: string; type: string; amount: number; createdAt: string }[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** Interactive loyalty card: stamp grid, progress and visit history. */
export function StampCard({ card }: { card: StampCardData }) {
  const [open, setOpen] = useState(false);
  const required = Math.max(1, card.stampsRequired);
  const balance = Math.min(required, Math.max(0, card.stampBalance));
  const complete = balance >= required;
  const remaining = Math.max(0, required - balance);

  return (
    <li className="overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)]">
      <div className="brand-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold leading-tight">{card.storeName}</p>
            <p className="text-xs opacity-80">{card.programName}</p>
          </div>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
            {balance}/{required}
          </span>
        </div>
        {card.reward && (
          <p className="mt-3 flex items-center gap-2 text-sm opacity-95">
            <Gift className="h-4 w-4 shrink-0" />
            {t("wallet.card.reward", { reward: card.reward })}
          </p>
        )}
      </div>

      <div className="p-4">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(required, 5)}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: required }).map((_, index) => {
            const filled = index < balance;
            return (
              <div
                key={index}
                aria-label={filled ? "stamp collected" : "stamp empty"}
                className={
                  filled
                    ? "flex aspect-square items-center justify-center rounded-2xl bg-primary text-primary-foreground"
                    : "flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-border text-muted-foreground"
                }
              >
                {filled ? <Check className="h-4 w-4" /> : <Stamp className="h-4 w-4 opacity-40" />}
              </div>
            );
          })}
        </div>

        <p className={`mt-4 text-sm font-semibold ${complete ? "text-accent-foreground" : "text-foreground"}`}>
          {complete ? t("wallet.card.ready") : t("wallet.card.toGo", { count: remaining })}
        </p>
        {card.lastVisitAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("wallet.card.lastVisit", { date: formatDate(card.lastVisitAt) })}
          </p>
        )}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary"
          aria-expanded={open}
        >
          {open ? t("wallet.card.hide") : t("wallet.card.history")}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <ul className="mt-2 space-y-1 border-t border-border pt-2">
            {card.visits.length === 0 ? (
              <li className="text-xs text-muted-foreground">{t("wallet.card.noHistory")}</li>
            ) : (
              card.visits.map((visit) => (
                <li key={visit.id} className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatDate(visit.createdAt)}</span>
                  <span className="font-semibold text-foreground">+{visit.amount}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </li>
  );
}
