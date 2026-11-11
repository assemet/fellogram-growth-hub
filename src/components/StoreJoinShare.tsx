import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, Printer, Share2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { dirOf, getLocale, t } from "@/lib/i18n";
import { renderPoster } from "@/lib/poster";
import { getStoreJoinLink } from "@/lib/store.functions";
import { shareViaTelegram } from "@/lib/telegram";

/** Prints the already-rendered poster image on a full A4 page through a hidden iframe (no pop-up needed). */
function printPosterImage(url: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win || typeof win.print !== "function") {
      frame.remove();
      reject(new Error("PRINT_UNAVAILABLE"));
      return;
    }
    const safeTitle = title.replace(/[&<>"']/g, " ");
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}img{display:block;width:210mm;height:297mm}</style></head><body><img alt=""></body></html>`);
    doc.close();
    const img = doc.querySelector("img");
    if (!img) {
      frame.remove();
      reject(new Error("PRINT_UNAVAILABLE"));
      return;
    }
    img.onerror = () => {
      frame.remove();
      reject(new Error("PRINT_UNAVAILABLE"));
    };
    img.onload = () => {
      try {
        win.focus();
        win.print();
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        setTimeout(() => frame.remove(), 60_000);
      }
    };
    img.src = url;
  });
}

/** Merchant dashboard card: the store's join QR + link (the way customers get their card). */
export function StoreJoinShare({ storeName }: { storeName: string }) {
  const load = useServerFn(getStoreJoinLink);
  const { data } = useQuery({ queryKey: ["store-join-link"], queryFn: () => load(), staleTime: Infinity });
  const [qr, setQr] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ url: string; blob: Blob } | null>(null);

  useEffect(() => {
    if (!data?.link) return;
    let cancelled = false;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(data.link, { width: 640, margin: 1, color: { dark: "#1b1b3a", light: "#ffffff" } });
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
    const link = new URL(data.link);
    return renderPoster(
      data.link,
      {
        name: storeName,
        caption: t("join.poster.scan"),
        powered: t("join.poster.powered"),
        address: `${link.host}${link.pathname.split("/").slice(0, 2).join("/")}`, // t.me/<bot>
      },
      dirOf(getLocale()),
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

  const print = useMutation({
    mutationFn: async () => {
      const blob = await makePoster();
      const url = URL.createObjectURL(blob);
      try {
        await printPosterImage(url, storeName);
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
      const blob = await makePoster();
      const file = new File([blob], "fellogram-poster.png", { type: "image/png" });
      // The system share sheet (Save to Photos / Files / Print) where the browser has one.
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: storeName });
          return;
        }
      } catch (error) {
        if ((error as { name?: string } | null)?.name === "AbortError") return; // the person closed the sheet
      }
      showImage(blob);
    },
    onError: (error) => {
      console.error(error);
      toast.error(t("join.share.printError"));
    },
  });

  return (
    <section className="animate-arrive mt-5 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg font-bold">{t("join.share.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("join.share.body")}</p>

      <div className="mx-auto mt-4 flex h-48 w-48 items-center justify-center rounded-md bg-white p-2 ring-1 ring-border">
        {qr ? <img src={qr} alt={t("join.share.title")} className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">…</span>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="touch-action h-auto min-h-12 flex-col gap-0.5 whitespace-normal px-1 py-2 text-center text-xs font-semibold leading-tight" onClick={copy} disabled={!data?.link}>
          <Copy className="h-4 w-4" />
          {t("join.share.copy")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="touch-action h-auto min-h-12 flex-col gap-0.5 whitespace-normal px-1 py-2 text-center text-xs font-semibold leading-tight"
          onClick={() => data?.link && shareViaTelegram(data.link, t("join.share.text", { store: storeName }))}
          disabled={!data?.link}
        >
          <Share2 className="h-4 w-4" />
          {t("join.share.share")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="touch-action h-auto min-h-12 flex-col gap-0.5 whitespace-normal px-1 py-2 text-center text-xs font-semibold leading-tight"
          onClick={() => print.mutate()}
          disabled={!data?.link || print.isPending}
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
      </div>

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
            download="fellogram-poster.png"
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
