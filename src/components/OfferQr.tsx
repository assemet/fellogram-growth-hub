import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

import { t } from "@/lib/i18n";
import { requestOffer } from "@/lib/promotions.functions";
import { getMyCards } from "@/lib/store.functions";

/** Short-lived, single-use offer QR with a live countdown; closes itself with a thank-you once the cashier scans it. */
export function OfferQr({
  offerId,
  title,
  cardId,
  usesLeft,
  onClose,
}: {
  offerId: string;
  title: string;
  cardId: string;
  /** Uses left when the dialog opened; when it drops the cashier has collected the offer. */
  usesLeft: number;
  onClose: () => void;
}) {
  const request = useServerFn(requestOffer);
  const loadCards = useServerFn(getMyCards);
  const [done, setDone] = useState(false);
  const { data: cards } = useQuery({ queryKey: ["my-cards"], queryFn: () => loadCards(), enabled: !done, refetchInterval: done ? false : 3000 });
  const current = cards?.find((card) => card.id === cardId)?.offers.find((offer) => offer.id === offerId);
  useEffect(() => {
    if (done || !cards) return;
    // The offer is gone from the list, or has fewer uses left than when we opened: it was just used.
    if (!current || current.usesLeft < usesLeft) setDone(true);
  }, [cards, current, done, usesLeft]);

  const [src, setSrc] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setError(null);
    (async () => {
      const res = await request({ data: { offerId } });
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(`fellogram:o:${res.token}`, { width: 512, margin: 1, color: { dark: "#0b1f5c", light: "#ffffff" } });
      if (cancelled) return;
      setSrc(url);
      setExpiresAt(new Date(res.expiresAt).getTime());
    })().catch((e: Error) => {
      if (cancelled) return;
      setError(e.message.includes("OFFER_ALREADY_USED") ? t("promo.err.used") : e.message.includes("OFFER_NOT_ACTIVE") ? t("promo.err.inactive") : t("common.error"));
    });
    return () => {
      cancelled = true;
    };
  }, [offerId, nonce, request]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const expired = src !== null && left === 0;
  const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4 sm:items-center" role="dialog" aria-modal="true">
        <div className="animate-arrive w-full max-w-sm rounded-lg border border-border bg-card p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center shadow-[var(--shadow-float)]">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden="true" />
          <p className="mt-3 font-display text-lg font-bold">{t("promo.offer.done")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{title}</p>
          <Button type="button" onClick={onClose} className="touch-action mt-5 h-12 w-full font-semibold">
            {t("rewards.done.close")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="animate-arrive w-full max-w-sm rounded-lg border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center shadow-[var(--shadow-float)]">
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold">{title}</p>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t("rewards.close")}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("rewards.showCashier")}</p>
        <div className="mx-auto mt-4 aspect-square w-60 overflow-hidden rounded-md border border-border bg-background">
          {src && !expired && <img src={src} alt={t("rewards.qrAlt")} className="h-full w-full" />}
          {(expired || error) && <div className="flex h-full items-center justify-center p-4 text-sm font-semibold text-muted-foreground">{error ?? t("rewards.expired")}</div>}
        </div>
        {src && !expired && <p className="mt-3 text-sm font-semibold text-primary">{t("rewards.expiresIn", { time })}</p>}
        {(expired || error) && (
          <Button type="button" onClick={() => setNonce((n) => n + 1)} className="touch-action mt-3 h-12 w-full font-semibold">
            {t("rewards.again")}
          </Button>
        )}
      </div>
    </div>
  );
}
