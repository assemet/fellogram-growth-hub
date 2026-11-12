import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";

import { Confetti } from "@/components/Confetti";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/feedback";
import { t } from "@/lib/i18n";

type CelebrationCard = { id: string; storeName: string; reward?: string | null; stampsRequired: number; stampBalance: number };

const KEY = "fellogram.celebrated";

function readDone(): Record<string, true> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return raw && typeof raw === "object" ? (raw as Record<string, true>) : {};
  } catch {
    return {};
  }
}

function writeDone(done: Record<string, true>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(done));
  } catch {
    /* storage is best-effort: the worst case is celebrating again next time */
  }
}

/**
 * Finds the first card whose stamps have just reached the full count and have not been celebrated yet.
 * A card is celebrated once per fill: it is "re-armed" when its balance drops again (after the reward is claimed).
 */
export function useCardCelebration(cards: CelebrationCard[] | undefined) {
  const [current, setCurrent] = useState<CelebrationCard | null>(null);

  useEffect(() => {
    if (!cards || current) return;
    const done = readDone();
    // Re-arm cards whose balance dropped again (the reward was claimed), so the next fill is celebrated too.
    const rearmed = cards.filter((card) => card.stampBalance < Math.max(1, card.stampsRequired) && done[card.id]);
    for (const card of rearmed) delete done[card.id];
    if (rearmed.length > 0) writeDone(done);
    const next = cards.find((card) => card.stampBalance >= Math.max(1, card.stampsRequired) && !done[card.id]);
    if (next) {
      setCurrent(next);
      notify("success");
    }
  }, [cards, current]);

  return {
    card: current,
    // Marked as celebrated only once it was actually shown and closed.
    dismiss: () => {
      if (current) writeDone({ ...readDone(), [current.id]: true });
      setCurrent(null);
    },
  };
}

/** Full-screen confetti with a "card complete" message, shown once when a loyalty card fills up. */
export function CardCelebration({ card, onClose }: { card: CelebrationCard; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/55 p-5" role="dialog" aria-modal="true" aria-labelledby="celebration-title">
      <Confetti fixed />
      <div className="animate-arrive relative w-full max-w-sm rounded-lg border border-border bg-card p-6 text-center shadow-[var(--shadow-float)]">
        <span className="animate-stamp-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold text-gold-foreground">
          <PartyPopper className="h-9 w-9" aria-hidden="true" />
        </span>
        <h2 id="celebration-title" className="mt-4 font-display text-2xl font-bold">
          {t("celebrate.title")}
        </h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{card.storeName}</p>
        <p className="mt-3 text-sm">{card.reward ? t("celebrate.body", { reward: card.reward }) : t("celebrate.bodyNoReward")}</p>
        <Button type="button" onClick={onClose} className="touch-action mt-5 h-12 w-full font-bold" autoFocus>
          {t("celebrate.close")}
        </Button>
      </div>
    </div>
  );
}
