import { Ticket, Zap } from "lucide-react";

import { t } from "@/lib/i18n";

type PromoSource = {
  event?: { multiplier: number } | null;
  offers?: { usesLeft: number }[];
};

/**
 * A small badge for a card that has something going on: a running stamp event (×2) wins over an unused
 * offer, because it changes every visit. Renders nothing when there is nothing to announce.
 */
export function PromoBadge({ card, className = "" }: { card: PromoSource; className?: string }) {
  const openOffers = (card.offers ?? []).filter((offer) => offer.usesLeft > 0).length;
  const base = `inline-flex shrink-0 items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-xs font-extrabold text-gold-foreground ${className}`;
  if (card.event) {
    return (
      <span className={base} aria-label={t("promo.badge.event", { n: card.event.multiplier })}>
        <Zap className="h-3.5 w-3.5" aria-hidden="true" />
        ×{card.event.multiplier}
      </span>
    );
  }
  if (openOffers > 0) {
    return (
      <span className={base}>
        <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
        {t("promo.badge.offer")}
      </span>
    );
  }
  return null;
}
