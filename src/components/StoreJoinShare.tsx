import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { dirOf, getLocale, t } from "@/lib/i18n";
import { blobToBase64, renderPoster } from "@/lib/poster";
import { sendJoinPoster } from "@/lib/poster.functions";
import { getStoreJoinLink } from "@/lib/store.functions";
import { isTelegramPhone, shareViaTelegram } from "@/lib/telegram";

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
export function StoreJoinShare({
  storeName,
  rewardName,
  stampsRequired,
}: {
  storeName: string;
  rewardName: string;
  stampsRequired: number;
}) {
  const load = useServerFn(getStoreJoinLink);
  const { data } = useQuery({ queryKey: ["store-join-link"], queryFn: () => load(), staleTime: Infinity });
  const sendPoster = useServerFn(sendJoinPoster);
  const phone = isTelegramPhone();
  const [qr, setQr] = useState<string | null>(null);

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

  const poster = useMutation({
    mutationFn: async () => {
      if (!data?.link) throw new Error("POSTER_UNAVAILABLE");
      const locale = getLocale();
      const blob = await renderPoster(
        data.link,
        {
          headline: t("join.poster.headline", { store: storeName }),
          rewardLine: t("join.poster.reward", { count: stampsRequired, reward: rewardName }),
          hint: t("join.poster.hint"),
          powered: t("join.poster.powered"),
        },
        dirOf(locale),
      );

      // Telegram's phone apps cannot print: put the poster in the owner's own chat with the bot instead.
      const sendToChat = async () => {
        const result = await sendPoster({ data: { png: await blobToBase64(blob), caption: t("join.poster.headline", { store: storeName }) } });
        if (result.ok) toast.success(t("join.share.sent"));
        else if (result.reason === "no_chat" || result.reason === "blocked") toast.error(t("join.share.noChat"));
        else toast.error(t("join.share.sendError"));
      };
      if (phone) return sendToChat();

      const url = URL.createObjectURL(blob);
      try {
        await printPosterImage(url, t("join.poster.headline", { store: storeName }));
      } catch {
        // Printing is blocked here (some embedded browsers): fall back to the chat copy.
        await sendToChat();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
      }
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

      <div className="mt-4 grid grid-cols-3 gap-2">
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
          onClick={() => poster.mutate()}
          disabled={!data?.link || poster.isPending}
        >
          <Printer className="h-4 w-4" />
          {phone ? t("join.share.sendPoster") : t("join.share.print")}
        </Button>
      </div>
    </section>
  );
}
