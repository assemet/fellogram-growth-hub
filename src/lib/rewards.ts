/**
 * Reward tiers. The main reward is the one earned by completing the card; extra tiers ("milestones")
 * exist to be earned BEFORE that, so a tier needing as many stamps as the card, or more, makes no sense.
 */
export type TierLike = { id: string; stamps_required: number; created_at?: string | null };

const byCreated = (a: TierLike, b: TierLike) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id);

/** The main reward: the earliest-created reward that needs exactly the card's stamps (the program form keeps it in sync). */
export function mainRewardId(rewards: TierLike[], cardStamps: number): string | null {
  return rewards.filter((reward) => reward.stamps_required === cardStamps).sort(byCreated)[0]?.id ?? null;
}

/** An extra tier is valid only if it can be earned before the card is complete. */
export function isValidTier(stampsRequired: number, cardStamps: number): boolean {
  return stampsRequired < cardStamps;
}

/** What a customer may see and redeem: the main reward plus every tier below it. */
export function visibleRewards<T extends TierLike>(rewards: T[], cardStamps: number): T[] {
  const main = mainRewardId(rewards, cardStamps);
  return rewards.filter((reward) => reward.id === main || isValidTier(reward.stamps_required, cardStamps));
}
