/** How the customer's wallet lays out the cards, and which card comes first. Pure helpers, no UI. */
export const WALLET_VIEWS = ["full", "list", "grid"] as const;
export type WalletView = (typeof WALLET_VIEWS)[number];

export type WalletCardLike = {
  storeName: string;
  stampBalance: number;
  stampsRequired: number;
  lastVisitAt: string | null;
  rewards?: { stampsRequired: number }[];
};

export function cardProgress(card: Pick<WalletCardLike, "stampBalance" | "stampsRequired" | "rewards">) {
  const required = Math.max(1, card.stampsRequired);
  const balance = Math.min(required, Math.max(0, card.stampBalance));
  // A reward is ready when the card is full, or when any smaller reward tier has been reached.
  const ready = balance >= required || (card.rewards ?? []).some((reward) => reward.stampsRequired > 0 && card.stampBalance >= reward.stampsRequired);
  return { balance, required, ready, remaining: Math.max(0, required - balance), ratio: balance / required };
}

/** A couple of cards read best in full; with more, a compact list saves the scrolling. */
export function autoWalletView(count: number): WalletView {
  return count <= 2 ? "full" : "list";
}

/** Reward ready first, then closest to complete, then most recently visited, then by name. Returns a new array. */
export function sortWalletCards<T extends WalletCardLike>(cards: readonly T[]): T[] {
  return [...cards].sort((a, b) => {
    const pa = cardProgress(a);
    const pb = cardProgress(b);
    if (pa.ready !== pb.ready) return pa.ready ? -1 : 1;
    if (pa.ratio !== pb.ratio) return pb.ratio - pa.ratio;
    const va = a.lastVisitAt ? Date.parse(a.lastVisitAt) : 0;
    const vb = b.lastVisitAt ? Date.parse(b.lastVisitAt) : 0;
    if (va !== vb) return vb - va;
    return a.storeName.localeCompare(b.storeName);
  });
}

export function isWalletView(value: unknown): value is WalletView {
  return typeof value === "string" && (WALLET_VIEWS as readonly string[]).includes(value);
}
