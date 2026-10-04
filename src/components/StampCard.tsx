import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { InviteFriend } from "@/components/InviteFriend";
import { RedeemRewardQr } from "@/components/RedeemRewardQr";
import { ChevronDown, Gift, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StampIcon } from "@/components/StampIcon";
import { resolveCardTheme } from "@/lib/card-theme";

import { t } from "@/lib/i18n";

export type StampCardData = {
  id: string;
  storeName: string;
  programName: string;
  stampsRequired: number;
  stampBalance: number;
  reward: string | null;
  lastVisitAt: string | null;
  storeId?: string;
  referralsEnabled?: boolean;
  referrerBonus?: number;
  welcomeBonus?: number;
  logoUrl?: string | null;
  stampIcon?: string;
  cardTheme?: string;
  rewards?: { id: string; name: string; description: string | null; stampsRequired: number }[];
  visits: { id: string; type: string; amount: number; createdAt: string }[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** Interactive loyalty card: stamp grid, progress and visit history. */
export function StampCard({ card, preview = false }: { card: StampCardData; preview?: boolean }) {
  const [open, setOpen] = useState(false);
  const [redeeming, setRedeeming] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const rewards = card.rewards ?? [];
  const required = Math.max(1, card.stampsRequired);
  const balance = Math.min(required, Math.max(0, card.stampBalance));
  const complete = balance >= required;
  const remaining = Math.max(0, required - balance);

  return (
    <li data-card-theme={resolveCardTheme(card.cardTheme)} className="loyalty-card animate-arrive overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="loyalty-card-header brand-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {card.logoUrl && <img src={card.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-current/15 object-cover" />}
            <div className="min-w-0">
              <p className="font-display text-xl font-bold leading-tight break-words">{card.storeName}</p>
              <p className="mt-1 text-xs opacity-80">{card.programName}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-md border border-current/20 bg-card/15 px-3 py-1 text-sm font-extrabold backdrop-blur-md">
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

      <div className="loyalty-card-body p-5">
        <div
          className="grid grid-cols-5 gap-2"
        >
          {Array.from({ length: required }).map((_, index) => {
            const filled = index < balance;
            return (
              <div
                key={index}
                aria-label={filled ? "stamp collected" : "stamp empty"}
                className={
                  filled
                    ? "loyalty-stamp-filled stamp-slot flex aspect-square items-center justify-center rounded-full border-2 border-primary/25 bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
                    : "loyalty-stamp-empty flex aspect-square items-center justify-center rounded-full border-2 border-dashed border-border bg-secondary/40 text-muted-foreground"
                }
              >
                <StampIcon name={card.stampIcon} className={filled ? "h-5 w-5" : "h-4 w-4 opacity-35"} />
              </div>
            );
          })}
        </div>

        <div className="loyalty-progress-track mt-4 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={balance} aria-valuemin={0} aria-valuemax={required} aria-label="Stamp progress">
          <div className="loyalty-progress-fill h-full rounded-full bg-growth transition-[width] duration-500" style={{ width: `${Math.min(100, (balance / Math.max(1, required)) * 100)}%` }} />
        </div>
        <p className={`loyalty-status mt-3 text-sm font-semibold ${complete ? "text-primary" : "text-foreground"}`}>
          {complete ? t("wallet.card.ready") : t("wallet.card.toGo", { count: remaining })}
        </p>
        {!preview && card.lastVisitAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("wallet.card.lastVisit", { date: formatDate(card.lastVisitAt) })}
          </p>
        )}

        {!preview && rewards.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground">{t("rewards.title")}</p>
            {rewards.map((reward) => {
              const available = card.stampBalance >= reward.stampsRequired;
              return (
                <div key={reward.id} className="loyalty-reward-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-secondary px-3 py-3">
                  <div className="min-w-0">
                    <p className="loyalty-reward-name truncate text-sm font-semibold text-secondary-foreground">{reward.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {available
                        ? `${reward.stampsRequired} · ${t("rewards.available")}`
                        : `${reward.stampsRequired} · ${t("rewards.locked", { count: reward.stampsRequired - card.stampBalance })}`}
                    </p>
                  </div>
                  {available && (
                    <Button
                      type="button"
                      onClick={() => setRedeeming({ id: reward.id, name: reward.name })}
                      size="sm"
                      className="loyalty-card-action touch-action shrink-0 text-xs font-bold"
                    >
                      {t("rewards.redeem")}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!preview && card.referralsEnabled && card.storeId && (
          <Button
            type="button"
            onClick={() => setInviting(true)}
            variant="outline"
            className="loyalty-card-outline touch-action mt-4 w-full"
          >
            <UserPlus className="h-4 w-4" />
            {t("referral.invite")}
          </Button>
        )}

        {inviting && card.storeId && (
          <InviteFriend
            storeId={card.storeId}
            storeName={card.storeName}
            referrerBonus={card.referrerBonus ?? 0}
            welcomeBonus={card.welcomeBonus ?? 0}
            onClose={() => setInviting(false)}
          />
        )}

        {redeeming && (
          <RedeemRewardQr
            rewardId={redeeming.id}
            rewardName={redeeming.name}
            onClose={() => {
              setRedeeming(null);
              queryClient.invalidateQueries({ queryKey: ["my-cards"] });
            }}
          />
        )}

        {!preview && <Button
          type="button"
          onClick={() => setOpen((value) => !value)}
          variant="ghost"
          size="sm"
          className="loyalty-card-link mt-3 -ml-2 text-xs font-semibold text-primary"
          aria-expanded={open}
        >
          {open ? t("wallet.card.hide") : t("wallet.card.history")}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>}

        {open && (
          <ul className="mt-2 space-y-1 border-t border-border pt-2">
            {card.visits.length === 0 ? (
              <li className="text-xs text-muted-foreground">{t("wallet.card.noHistory")}</li>
            ) : (
              card.visits.map((visit) => (
                <li key={visit.id} className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatDate(visit.createdAt)}</span>
                  <span className="font-semibold text-foreground">
                    {visit.type === "stamp_awarded" || visit.type === "referral_reward" ? "+" : "−"}
                    {visit.amount}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </li>
  );
}
