import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

import { t } from "@/lib/i18n";
import { requestRedemption } from "@/lib/store.functions";

/** Short-lived, single-use reward QR with a live countdown. */
export function RedeemRewardQr({
  rewardId,
  rewardName,
  onClose,
}: {
  rewardId: string;
  rewardName: string;
  onClose: () => void;
}) {
  const request = useServerFn(requestRedemption);
  const [src, setSrc] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setError(null);
    (async () => {
      const res = await request({ data: { rewardId } });
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(`fellogram:r:${res.token}`, {
        width: 512,
        margin: 1,
        color: { dark: "#1b1b3a", light: "#ffffff" },
      });
      if (cancelled) return;
      setSrc(url);
      setExpiresAt(new Date(res.expiresAt).getTime());
    })().catch((e: Error) => {
      if (!cancelled) setError(e.message.includes("NOT_ENOUGH_STAMPS") ? t("rewards.notEnough") : t("common.error"));
    });
    return () => {
      cancelled = true;
    };
  }, [rewardId, nonce, request]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const expired = src !== null && left === 0;
  const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="animate-arrive w-full max-w-sm rounded-lg border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center shadow-[var(--shadow-float)]">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold">{rewardName}</p>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t("rewards.close")}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("rewards.showCashier")}</p>

        <div className="mx-auto mt-4 aspect-square w-60 overflow-hidden rounded-md border border-border bg-background">
          {src && !expired && <img src={src} alt="Reward QR" className="h-full w-full" />}
          {(expired || error) && (
            <div className="flex h-full items-center justify-center p-4 text-sm font-semibold text-muted-foreground">
              {error ?? t("rewards.expired")}
            </div>
          )}
        </div>

        {src && !expired && (
          <p className="mt-3 text-sm font-semibold text-primary">{t("rewards.expiresIn", { time })}</p>
        )}
        {(expired || error) && (
          <Button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            className="touch-action mt-3 h-12 w-full font-semibold"
          >
            {t("rewards.again")}
          </Button>
        )}
      </div>
    </div>
  );
}
