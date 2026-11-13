import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { InviteFriend } from "@/components/InviteFriend";
import { GiftRibbon } from "@/components/GiftRibbon";
import { hasOpenOffer, PromoBadge } from "@/components/PromoBadge";
import { OfferQr } from "@/components/OfferQr";
import { RedeemRewardQr } from "@/components/RedeemRewardQr";
import { ReviewInvite, reviewInviteSeen } from "@/components/ReviewInvite";
import { stampColumns } from "@/lib/stamp-layout";
import { contactLinks, type ContactField } from "@/lib/store-contact";
import { Building2, ChevronDown, Gift, Ticket, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StampIcon } from "@/components/StampIcon";
import { brandThemeStyle, resolveCardTheme } from "@/lib/card-theme";
import { Link } from "@tanstack/react-router";

import { formatShortDate as formatDate } from "@/lib/format";
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
  const showRibbon = !preview && hasOpenOffer(card);
  const required = Math.max(1, card.stampsRequired);
  const balance = Math.min(required, Math.max(0, card.stampBalance));
  const extra = Math.max(0, card.stampBalance - required);
  const complete = balance >= required;
  const remaining = Math.max(0, required - balance);

  return (
    <li data-card-theme={resolveCardTheme(card.cardTheme)} data-custom-brand={focused || preview || card.brandPrimary || card.brandAccent || card.backgroundTint ? "true" : undefined} style={brandThemeStyle(card.cardTheme, card)} className="loyalty-card loyalty-card-group animate-arrive space-y-4">
      <div className="loyalty-card-shell relative overflow-hidden rounded-3xl">
      {showRibbon && <GiftRibbon className="w-24" />}
      <div className="loyalty-card-header brand-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="store-avatar flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card/15" aria-hidden="true">
              {card.logoUrl ? <img src={card.logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="font-display text-2xl font-bold leading-tight break-words">{card.storeName}</p>
              <p className="mt-1 text-xs font-medium opacity-90">{card.programName}</p>
            </div>
          </div>
          <div className={`flex shrink-0 flex-col items-end gap-1.5 ${showRibbon ? "mt-9" : ""}`}>
            <span className="rounded-xl bg-card/15 px-3 py-1 text-sm font-extrabold backdrop-blur-md">
              {balance}/{required}
            </span>
            {!preview && <div className="flex flex-wrap justify-end gap-1"><PromoBadge card={card} hideOffer /></div>}
          </div>
        </div>
        {card.reward && (
          <p className="mt-3 flex items-center gap-2 text-sm opacity-95">
            <Gift className="h-4 w-4 shrink-0" />
            {t("wallet.card.reward", { reward: card.reward })}
          </p>
        )}
      </div>

      <div className="loyalty-card-body px-5 pb-5 pt-6">
        <div className="grid justify-center gap-3" style={{ gridTemplateColumns: `repeat(${stampColumns(required)}, minmax(0, 3.75rem))` }}>
          {Array.from({ length: required }).map((_, index) => {
            const filled = index < balance;
            const isReward = index === required - 1;
            return (
              <div
                key={index}
                aria-label={isReward ? t("wallet.card.rewardSlot") : filled ? t("wallet.card.stampCollected") : t("wallet.card.stampEmpty")}
                className={
                  filled && isReward
                    ? "stamp-slot flex aspect-square items-center justify-center overflow-hidden rounded-full bg-gold text-gold-foreground"
                    : filled
                      ? "loyalty-stamp-filled stamp-slot flex aspect-square items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground"
                      : "loyalty-stamp-empty flex aspect-square items-center justify-center overflow-hidden rounded-full bg-secondary/60 text-muted-foreground"
                }
              >
                {isReward ? (
                  <Gift className={filled ? "h-7 w-7" : "h-6 w-6 opacity-60"} aria-hidden="true" />
                ) : filled ? (
                  card.stampIcon === "logo" && card.logoUrl ? (
                    <StampIcon name="logo" logoUrl={card.logoUrl} className="h-full w-full" />
                  ) : (
                    <StampIcon name={card.stampIcon} className="h-7 w-7" />
                  )
                ) : (
                  <span className="text-base font-bold opacity-60" aria-hidden="true">{index + 1}</span>
                )}
              </div>
            );
          })}
        </div>

        <p className={`loyalty-status mt-5 text-sm font-semibold ${complete ? "text-primary" : "text-foreground"}`}>
          {complete ? t("wallet.card.ready") : t("wallet.card.toGo", { count: remaining })}
          {extra > 0 && <span className="ms-2 rounded-full bg-gold px-2 py-0.5 text-xs font-extrabold text-gold-foreground">{t("wallet.card.extra", { count: extra })}</span>}
        </p>
        {!preview && card.lastVisitAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("wallet.card.lastVisit", { date: formatDate(card.lastVisitAt) })}
          </p>
        )}

        {card.event && (
          <p className="mt-4 rounded-2xl bg-growth/15 px-3 py-2 text-xs font-bold text-foreground" role="status">
            {t("promo.banner", { n: card.event.multiplier, name: card.event.name, date: formatDate(card.event.endsAt) })}
          </p>
        )}

        {rewards.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">{t("rewards.title")}</p>
            {rewards.map((reward) => {
              const available = card.stampBalance >= reward.stampsRequired;
              return (
                <div key={reward.id} className="loyalty-reward-row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-secondary/70 px-4 py-3">
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

        {!preview && !focused && card.storeId && (
          <Button asChild variant="ghost" size="sm" className="loyalty-card-link mt-2 w-full text-primary">
            <Link to="/wallet" search={{ store: card.storeId }}>{t("wallet.viewStore")}</Link>
          </Button>
        )}

      </div>
      </div>

      {offers.length > 0 && (
        <section className="space-y-3" aria-label={t("promo.offers.title")}>
          {offers.map((offer) => {
            const usable = offer.usesLeft > 0;
            return (
              <div key={offer.id} className="coupon-card">
              <div className={`coupon-body flex min-h-24 items-stretch rounded-2xl ${usable && !preview ? "coupon-ticket" : ""}`}>
                <div className={`min-w-0 flex-1 px-4 py-3.5 ${usable ? "" : "opacity-60"}`}>
                  <p className="coupon-kicker flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider">
                    <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("promo.offers.title")}
                  </p>
                  <p className="mt-1 break-words text-base font-extrabold leading-snug">{offer.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{usable ? t("promo.until", { date: formatDate(offer.endsAt) }) : t("promo.offer.used")}</p>
                  {offer.details && usable && <p className="mt-0.5 text-xs text-muted-foreground">{offer.details}</p>}
                </div>
                {usable && !preview && (
                  <>
                    <div className="coupon-cut relative w-0" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => setUsingOffer({ id: offer.id, title: offer.title, usesLeft: offer.usesLeft })}
                      className="loyalty-card-action touch-action w-24 shrink-0 rounded-e-2xl bg-primary px-2 text-sm font-extrabold text-primary-foreground"
                    >
                      {t("promo.offer.use")}
                    </button>
                  </>
                )}
              </div>
              </div>
            );
          })}
        </section>
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
      {!preview && card.referralsEnabled && card.storeId && (
        <div className="loyalty-surface rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <span className="loyalty-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-full" aria-hidden="true">
              <UserPlus className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold">{t("referral.title")}</p>
              {(card.referrerBonus ?? 0) > 0 || (card.welcomeBonus ?? 0) > 0 ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{t("referral.body", { referrer: card.referrerBonus ?? 0, welcome: card.welcomeBonus ?? 0 })}</p>
              ) : null}
            </div>
          </div>
          <button type="button" onClick={() => setInviting(true)} className="loyalty-card-action touch-action mt-3 min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-extrabold text-primary-foreground">
            {t("referral.invite")}
          </button>
        </div>
      )}

      {!preview && (
        <div>
          <button type="button" onClick={() => setOpen((value) => !value)} className="loyalty-card-link touch-action mx-auto flex min-h-10 items-center gap-1 px-3 text-xs font-semibold" aria-expanded={open}>
            {open ? t("wallet.card.hide") : t("wallet.card.history")}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <ul className="loyalty-surface mt-2 space-y-2 rounded-2xl p-4">
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
    </li>
  );
}
