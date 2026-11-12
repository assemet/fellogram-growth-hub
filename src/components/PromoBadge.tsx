import { Ticket, Zap } from "lucide-react";

import { t } from "@/lib/i18n";

type PromoSource = {
  event?: { multiplier: number } | null;
  offers?: { usesLeft: number }[];
};

/**
 * Small badges for a card that has something going on: a running stamp event (×2) and/or an unused offer.
 * Both show when both exist, so neither hides the other. Renders nothing when there is nothing to announce.
 */
export function PromoBadge({ card, className = "" }: { card: PromoSource; className?: string }) {
  const openOffers = (card.offers ?? []).filter((offer) => offer.usesLeft > 0).length;
  const base = `inline-flex shrink-0 items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-xs font-extrabold text-gold-foreground ${className}`;
  return (
    <>
      {card.event && (
        <span className={base} aria-label={t("promo.badge.event", { n: card.event.multiplier })}>
          <Zap className="h-3.5 w-3.5" aria-hidden="true" />
          ×{card.event.multiplier}
        </span>
      )}
      {openOffers > 0 && (
        <span className={base}>
          <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
          {t("promo.badge.offer")}
        </span>
      )}
    </>
  );
}
