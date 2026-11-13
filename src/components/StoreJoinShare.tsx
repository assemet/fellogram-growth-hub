import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, Printer, Share2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { dirOf, getLocale, t } from "@/lib/i18n";
import { ShareLinkSheet } from "@/components/ShareLinkSheet";
import { PosterFormatPicker } from "@/components/PosterFormatPicker";
import { DEFAULT_POSTER_FORMAT, downloadBlob, posterAddress, posterPageUrl, printPosterImage, renderPoster, type PosterFormat } from "@/lib/poster";
import { getStoreJoinLink } from "@/lib/store.functions";
import { isTelegramPhone, openInPhoneBrowser } from "@/lib/telegram";

/** Merchant dashboard card: the store's join QR + link (the way customers get their card). */
export function StoreJoinShare({ storeName }: { storeName: string }) {
  const load = useServerFn(getStoreJoinLink);
  const { data } = useQuery({ queryKey: ["store-join-link"], queryFn: () => load(), staleTime: 20 * 60_000 });
  const [format, setFormat] = useState<PosterFormat>(DEFAULT_POSTER_FORMAT);
  const phone = isTelegramPhone();
  const [qr, setQr] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ url: string; blob: Blob } | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!data?.link) return;
    let cancelled = false;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(data.link, { width: 640, margin: 1, color: { dark: "#0b1f5c", light: "#ffffff" } });
      if (!cancelled) setQr(url);
    })().catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [data?.link]);

  const copy = async () => {
    if (!data?.link) return;
    try {
      await navigator.clipboard.writeText(data.link);
      toast.success(t("referral.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  /** The poster as an image, drawn fresh so it always matches the current store name and language. */
  const makePoster = async () => {
    if (!data?.link) throw new Error("POSTER_UNAVAILABLE");
    return renderPoster(
      data.link,
      {
        name: storeName,
        caption: t("join.poster.scan"),
        powered: t("join.poster.powered"),
        address: posterAddress(data.link), // t.me/<bot>/<app>
      },
      dirOf(getLocale()),
      { format, storeLogoUrl: data.logoUrl ?? null },
    );
  };

  /** Phones: the image itself, to long-press and save (works in every embedded browser). */
  const showImage = (blob: Blob) => setSaved((old) => {
    if (old) URL.revokeObjectURL(old.url);
    return { url: URL.createObjectURL(blob), blob };
  });
  const closeImage = () => setSaved((old) => {
    if (old) URL.revokeObjectURL(old.url);
    return null;
  });

  /** Telegram's phone apps cannot print or save files: open the poster page in the phone's own browser instead. */
  const openPosterPage = () => {
    if (!data?.link) return;
    openInPhoneBrowser(posterPageUrl(window.location.origin, storeName, data.link, getLocale(), data.logoUrl));
  };

  const print = useMutation({
    mutationFn: async () => {
      const blob = await makePoster();
      const url = URL.createObjectURL(blob);
      try {
        await printPosterImage(url, storeName, format.paper ?? undefined);
      } catch {
        // Printing is blocked in this browser: hand over the image instead.
        toast.error(t("join.share.printError"));
        showImage(blob);
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error(t("join.share.printError"));
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      // Straight to the device's downloads, not a share sheet.
      downloadBlob(await makePoster(), `fellogram-poster-${format.id}.png`);
    },
    onError: (error) => {
      console.error(error);
      toast.error(t("join.share.printError"));
    },
  });

  return (
    <section className="animate-arrive mt-5 rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg font-bold">{t("join.share.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("join.share.body")}</p>

      <div className="mx-auto mt-4 flex h-48 w-48 items-center justify-center rounded-2xl bg-white p-3 shadow-[var(--shadow-card)]">
        {qr ? <img src={qr} alt={t("join.share.title")} className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">…</span>}
      </div>

      {!phone && <div className="mt-4"><PosterFormatPicker value={format} onChange={setFormat} /></div>}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="touch-action h-auto min-h-12 flex-col gap-0.5 whitespace-normal px-1 py-2 text-center text-xs font-semibold leading-tight" onClick={copy} disabled={!data?.link}>
          <Copy className="h-4 w-4" />
          {t("join.share.copy")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="touch-action h-auto min-h-12 flex-col gap-0.5 whitespace-normal px-1 py-2 text-center text-xs font-semibold leading-tight"
          onClick={() => setSharing(true)}
          disabled={!data?.link}
        >
          <Share2 className="h-4 w-4" />
          {t("join.share.share")}
        </Button>
        {phone ? (
          <Button
            type="button"
            variant="outline"
            className="touch-action col-span-2 h-auto min-h-12 gap-2 whitespace-normal px-2 py-2 text-center text-sm font-semibold leading-tight"
            onClick={openPosterPage}
            disabled={!data?.link}
          >
            <Printer className="h-4 w-4" />
            {t("join.share.poster")}
          </Button>
        ) : (
          <>
        <Button
              type="button"
              variant="outline"
              className="touch-action h-auto min-h-12 flex-col gap-0.5 whitespace-normal px-1 py-2 text-center text-xs font-semibold leading-tight"
              onClick={() => print.mutate()}
              disabled={!data?.link || print.isPending || !format.paper}
            >
              <Printer className="h-4 w-4" />
              {t("join.share.print")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="touch-action h-auto min-h-12 flex-col gap-0.5 whitespace-normal px-1 py-2 text-center text-xs font-semibold leading-tight"
              onClick={() => save.mutate()}
              disabled={!data?.link || save.isPending}
            >
              <Download className="h-4 w-4" />
              {t("join.share.save")}
            </Button>
          </>
        )}
      </div>

      {sharing && data?.link && (
        <ShareLinkSheet link={data.link} text={t("join.share.text", { store: storeName })} subject={storeName} onClose={() => setSharing(false)} />
      )}

      {saved && (
        <div className="fixed inset-0 z-50 flex flex-col items-center gap-3 overflow-y-auto bg-foreground/60 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" role="dialog" aria-modal="true">
          <div className="flex w-full max-w-sm justify-end">
            <Button type="button" variant="secondary" size="icon" onClick={closeImage} aria-label={t("rewards.close")}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <img src={saved.url} alt={storeName} className="w-full max-w-sm rounded-md bg-white shadow-[var(--shadow-float)]" />
          <p className="max-w-sm text-center text-sm font-medium text-background">{t("join.share.saveHint")}</p>
          <a
            href={saved.url}
            download={`fellogram-poster-${format.id}.png`}
            className="touch-action inline-flex h-12 w-full max-w-sm items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            <Download className="h-4 w-4" />
            {t("join.share.download")}
          </a>
        </div>
      )}
    </section>
  );
}
