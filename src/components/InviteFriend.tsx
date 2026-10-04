import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { t } from "@/lib/i18n";
import { getReferralLink } from "@/lib/store.functions";

/** Personal Telegram invite link for one store. */
export function InviteFriend({
  storeId,
  storeName,
  referrerBonus,
  welcomeBonus,
  onClose,
}: {
  storeId: string;
  storeName: string;
  referrerBonus: number;
  welcomeBonus: number;
  onClose: () => void;
}) {
  const load = useServerFn(getReferralLink);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["referral-link", storeId],
    queryFn: () => load({ data: { storeId } }),
    staleTime: Infinity,
  });

  const share = () => {
    if (!data?.link) return;
    const text = `Join me at ${storeName} on Fellogram and get bonus stamps!`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(data.link)}&text=${encodeURIComponent(text)}`;
    const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, "_blank", "noopener");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(data?.link ?? data?.param ?? "");
    toast.success(t("referral.copied"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="animate-arrive w-full max-w-sm rounded-lg border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-float)]">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold">{t("referral.title")}</p>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t("rewards.close")}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("referral.body", { referrer: referrerBonus, welcome: welcomeBonus })}
        </p>

        {isLoading && <p className="mt-4 text-sm text-muted-foreground">{t("app.loading")}</p>}
        {isError && <p className="mt-4 text-sm text-destructive">{t("common.error")}</p>}
        {data && (
          <>
            {!data.link && <p className="mt-4 text-xs text-muted-foreground">{t("referral.noBot")}</p>}
            <p className="mt-3 break-all rounded-md bg-secondary px-3 py-2 font-mono text-xs text-secondary-foreground">
              {data.link ?? data.param}
            </p>
            {data.link && (
              <Button
                type="button"
                onClick={share}
                className="touch-action mt-4 h-12 w-full font-bold"
              >
                {t("referral.share")}
              </Button>
            )}
            <Button
              type="button"
              onClick={copy}
              variant="outline" className="touch-action mt-2 h-12 w-full font-semibold"
            >
              {t("referral.copy")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
