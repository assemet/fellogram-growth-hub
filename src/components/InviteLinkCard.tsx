import { useEffect, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { shareViaTelegram } from "@/lib/telegram";

/** A cashier invitation link with QR, copy and Telegram share. */
export function InviteLinkCard({ link, storeName }: { link: string; storeName: string }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: "#1b1b3a", light: "#ffffff" } });
      if (!cancelled) setQr(url);
    })().catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("referral.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <div className="animate-arrive rounded-lg border border-border bg-card p-5 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-md bg-white p-2 ring-1 ring-border">
        {qr ? <img src={qr} alt="" className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">…</span>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t("team.inviteHint")}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="touch-action h-12 gap-2 font-semibold" onClick={copy}>
          <Copy className="h-4 w-4" />
          {t("join.share.copy")}
        </Button>
        <Button
          type="button"
          className="touch-action h-12 gap-2 font-semibold"
          onClick={() => shareViaTelegram(link, t("team.shareText", { store: storeName }))}
        >
          <Share2 className="h-4 w-4" />
          {t("join.share.share")}
        </Button>
      </div>
    </div>
  );
}
