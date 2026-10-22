import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getLocale, t } from "@/lib/i18n";
import { getStoreJoinLink } from "@/lib/store.functions";
import { shareViaTelegram } from "@/lib/telegram";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** Prints the join QR as a simple poster through a hidden iframe (no pop-up needed). */
function printPoster(opts: { qr: string; headline: string; rewardLine: string; powered: string }) {
  const locale = getLocale();
  const html = `<!doctype html><html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${escapeHtml(opts.headline)}</title>
<style>@page{margin:16mm}body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;color:#1b1b3a;margin:0;padding:24px}
h1{font-size:44px;margin:0 0 10px}p{font-size:24px;margin:8px 0}img{width:440px;height:440px;margin:28px auto;display:block}small{color:#555;font-size:16px}</style></head>
<body><h1>${escapeHtml(opts.headline)}</h1><p>${escapeHtml(opts.rewardLine)}</p><img src="${opts.qr}" alt=""><small>${escapeHtml(opts.powered)}</small></body></html>`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) {
    frame.remove();
    throw new Error("PRINT_UNAVAILABLE");
  }
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 2000);
  };
  const img = doc.querySelector("img");
  if (img && !img.complete) img.onload = go;
  else go();
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

  const print = () => {
    if (!qr) return;
    try {
      printPoster({
        qr,
        headline: t("join.poster.headline", { store: storeName }),
        rewardLine: t("join.poster.reward", { count: stampsRequired, reward: rewardName }),
        powered: t("join.poster.powered"),
      });
    } catch {
      toast.error(t("join.share.printError"));
    }
  };

  return (
    <section className="animate-arrive mt-5 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="font-display text-lg font-bold">{t("join.share.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("join.share.body")}</p>

      <div className="mx-auto mt-4 flex h-48 w-48 items-center justify-center rounded-md bg-white p-2 ring-1 ring-border">
        {qr ? <img src={qr} alt={t("join.share.title")} className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">…</span>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button type="button" variant="outline" className="touch-action h-12 flex-col gap-0.5 px-1 text-xs font-semibold" onClick={copy} disabled={!data?.link}>
          <Copy className="h-4 w-4" />
          {t("join.share.copy")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="touch-action h-12 flex-col gap-0.5 px-1 text-xs font-semibold"
          onClick={() => data?.link && shareViaTelegram(data.link, t("join.share.text", { store: storeName }))}
          disabled={!data?.link}
        >
          <Share2 className="h-4 w-4" />
          {t("join.share.share")}
        </Button>
        <Button type="button" variant="outline" className="touch-action h-12 flex-col gap-0.5 px-1 text-xs font-semibold" onClick={print} disabled={!qr}>
          <Printer className="h-4 w-4" />
          {t("join.share.print")}
        </Button>
      </div>
    </section>
  );
}
