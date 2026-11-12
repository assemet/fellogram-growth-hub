import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { InviteFriend } from "@/components/InviteFriend";
import { PromoBadge } from "@/components/PromoBadge";
import { OfferQr } from "@/components/OfferQr";
import { RedeemRewardQr } from "@/components/RedeemRewardQr";
import { ReviewInvite, reviewInviteSeen } from "@/components/ReviewInvite";
import { stampColumns } from "@/lib/stamp-layout";
import { contactLinks, type ContactField } from "@/lib/store-contact";
import { Building2, ChevronDown, Gift, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StampIcon } from "@/components/StampIcon";
import { brandThemeStyle, resolveCardTheme } from "@/lib/card-theme";
import { Link } from "@tanstack/react-router";

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
  contact?: Partial<Record<ContactField, string | null>>;
  referralsEnabled?: boolean;
  referrerBonus?: number;
  welcomeBonus?: number;
  logoUrl?: string | null;
  stampIcon?: string;
  cardTheme?: string;
  brandPrimary?: string | null;
  brandAccent?: string | null;
  backgroundTint?: string | null;
  rewards?: { id: string; name: string; description: string | null; stampsRequired: number }[];
  /** A running multiplied-stamps event at this store, if any. */
  event?: { name: string; multiplier: number; endsAt: string } | null;
  /** Open single-use offers; usesLeft is 0 once this customer has used it up. */
  offers?: { id: string; title: string; details: string | null; endsAt: string; usesLeft: number }[];
  visits: { id: string; type: string; amount: number; createdAt: string }[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** Interactive loyalty card: stamp grid, progress and visit history. */
export function StampCard({ card, preview = false, focused = false }: { card: StampCardData; preview?: boolean; focused?: boolean }) {
  const [open, setOpen] = useState(false);
  const [usingOffer, setUsingOffer] = useState<{ id: string; title: string; usesLeft: number } | null>(null);
  const [redeeming, setRedeeming] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const [redeemedNow, setRedeemedNow] = useState(false);
  const [inviteDone, setInviteDone] = useState(false);
  const reviewHref = contactLinks(card.contact ?? {}).find((link) => link.kind === "review")?.href;
  const rewards = card.rewards ?? [];
  const offers = card.offers ?? [];
  const required = Math.max(1, card.stampsRequired);
  const balance = Math.min(required, Math.max(0, card.stampBalance));
  const complete = balance >= required;
  const remaining = Math.max(0, required - balance);

  return (
    <li data-card-theme={resolveCardTheme(card.cardTheme)} data-custom-brand={focused || preview || card.brandPrimary || card.brandAccent || card.backgroundTint ? "true" : undefined} style={brandThemeStyle(card.cardTheme, card)} className="loyalty-card animate-arrive overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="loyalty-card-header brand-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="store-avatar flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-current/20 bg-card/15" aria-hidden="true">
              {card.logoUrl ? <img src={card.logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="font-display text-2xl font-bold leading-tight break-words">{card.storeName}</p>
              <p className="mt-1 text-xs font-medium opacity-90">{card.programName}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="rounded-md border border-current/20 bg-card/15 px-3 py-1 text-sm font-extrabold backdrop-blur-md">
              {balance}/{required}
            </span>
            {!preview && <div className="flex flex-wrap justify-end gap-1"><PromoBadge card={card} /></div>}
          </div>
        </div>
        {card.reward && (
          <p className="mt-3 flex items-center gap-2 text-sm opacity-95">
            <Gift className="h-4 w-4 shrink-0" />
            {t("wallet.card.reward", { reward: card.reward })}
          </p>
        )}
      </div>

      <div className="loyalty-card-body p-5">
        <div className="grid justify-center gap-2" style={{ gridTemplateColumns: `repeat(${stampColumns(required)}, minmax(0, 3.75rem))` }}>
          {Array.from({ length: required }).map((_, index) => {
            const filled = index < balance;
            return (
              <div
                key={index}
                aria-label={filled ? t("wallet.card.stampCollected") : t("wallet.card.stampEmpty")}
                className={
                  filled
                    ? "loyalty-stamp-filled stamp-slot flex aspect-square items-center justify-center overflow-hidden rounded-full border-2 border-primary/25 bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
                    : "loyalty-stamp-empty flex aspect-square items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-secondary/40 text-muted-foreground"
                }
              >
                {card.stampIcon === "logo" && card.logoUrl ? (
                  <StampIcon name="logo" logoUrl={card.logoUrl} dim={!filled} className="h-full w-full" />
                ) : (
                  <StampIcon name={card.stampIcon} className={filled ? "h-5 w-5" : "h-4 w-4 opacity-35"} />
                )}
              </div>
            );
          })}
        </div>

        <div className="loyalty-progress-track mt-4 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={balance} aria-valuemin={0} aria-valuemax={required} aria-label={t("wallet.card.progress")}>
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

        {card.event && (
          <p className="mt-3 rounded-md bg-growth/15 px-3 py-2 text-xs font-bold text-foreground" role="status">
            {t("promo.banner", { n: card.event.multiplier, name: card.event.name, date: formatDate(card.event.endsAt) })}
          </p>
        )}

        {offers.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground">{t("promo.offers.title")}</p>
            {offers.map((offer) => (
              <div key={offer.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-secondary px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-secondary-foreground">{offer.title}</p>
                  <p className="text-xs text-muted-foreground">{offer.usesLeft > 0 ? t("promo.until", { date: formatDate(offer.endsAt) }) : t("promo.offer.used")}</p>
                  {offer.details && offer.usesLeft > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{offer.details}</p>}
                </div>
                {offer.usesLeft > 0 && !preview && (
                  <Button type="button" size="sm" onClick={() => setUsingOffer({ id: offer.id, title: offer.title, usesLeft: offer.usesLeft })} className="loyalty-card-action touch-action shrink-0 text-xs font-bold">
                    {t("promo.offer.use")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {usingOffer && (
          <OfferQr
            offerId={usingOffer.id}
            title={usingOffer.title}
            cardId={card.id}
            usesLeft={usingOffer.usesLeft}
            onClose={() => {
              setUsingOffer(null);
              queryClient.invalidateQueries({ queryKey: ["my-cards"] });
            }}
          />
        )}

        {rewards.length > 0 && (
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
                  {available && !preview && (
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
            className="loyalty-card-outline touch-action mt-4 h-11 w-full font-bold"
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
            cardId={card.id}
            balance={card.stampBalance}
            onRedeemed={() => setRedeemedNow(true)}
            onClose={() => {
              setRedeeming(null);
              queryClient.invalidateQueries({ queryKey: ["my-cards"] });
            }}
          />
        )}

        {!preview && !redeeming && redeemedNow && !inviteDone && reviewHref && card.storeId && !reviewInviteSeen(card.storeId) && (
          <ReviewInvite storeId={card.storeId} storeName={card.storeName} href={reviewHref} onDone={() => setInviteDone(true)} />
        )}

        {!preview && <Button
          type="button"
          onClick={() => setOpen((value) => !value)}
          variant="ghost"
          size="sm"
          className="loyalty-card-link mt-3 -ms-2 text-xs font-semibold text-primary"
          aria-expanded={open}
        >
          {open ? t("wallet.card.hide") : t("wallet.card.history")}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>}

        {!preview && !focused && card.storeId && (
          <Button asChild variant="ghost" size="sm" className="loyalty-card-link mt-2 w-full text-primary">
            <Link to="/wallet" search={{ store: card.storeId }}>{t("wallet.viewStore")}</Link>
          </Button>
        )}

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
