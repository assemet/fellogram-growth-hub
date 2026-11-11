import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { openExternalLink } from "@/lib/telegram";

const key = (storeId: string) => `fellogram.reviewInvite.${storeId}`;

/** Whether this device already saw the invitation for the store (it is shown once, then never pushed again). */
export function reviewInviteSeen(storeId: string): boolean {
  try {
    return localStorage.getItem(key(storeId)) !== null;
  } catch {
    return false;
  }
}

function markSeen(storeId: string) {
  try {
    localStorage.setItem(key(storeId), String(Date.now()));
  } catch {
    // Private mode: the invitation may show again, which is harmless.
  }
}

/**
 * One optional, neutral invitation after a reward was collected. It never promises anything in return and never
 * filters by satisfaction: everybody sees the same invitation and can dismiss it.
 */
export function ReviewInvite({ storeId, storeName, href, onDone }: { storeId: string; storeName: string; href: string; onDone: () => void }) {
  return (
    <div className="animate-arrive mt-3 rounded-md border border-border bg-background p-3" role="region" aria-label={t("review.invite.title")}>
      <p className="flex items-center gap-2 text-sm font-bold">
        <Star className="h-4 w-4 text-primary" aria-hidden="true" />
        {t("review.invite.title")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{t("review.invite.body", { store: storeName })}</p>
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          className="touch-action min-h-10 flex-1 font-semibold"
          onClick={() => {
            markSeen(storeId);
            openExternalLink(href);
            onDone();
          }}
        >
          {t("review.invite.action")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="touch-action min-h-10 flex-1"
          onClick={() => {
            markSeen(storeId);
            onDone();
          }}
        >
          {t("review.invite.later")}
        </Button>
      </div>
    </div>
  );
}
