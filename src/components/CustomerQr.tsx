import { useEffect, useState } from "react";

import { t } from "@/lib/i18n";

/** Stable customer identity QR, rendered client-side only. */
export function CustomerQr({ customerId }: { customerId: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(`fellogram:c:${customerId}`, {
        width: 512,
        margin: 1,
        color: { dark: "#1b1b3a", light: "#ffffff" },
      });
      if (!cancelled) setSrc(url);
    })().catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return (
    <div className="rounded-3xl bg-card p-5 text-center shadow-[var(--shadow-card)]">
      <p className="font-display text-base font-bold">{t("qr.title")}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("qr.subtitle")}</p>
      <div className="mx-auto mt-4 flex h-48 w-48 items-center justify-center rounded-2xl bg-white p-2">
        {src ? (
          <img src={src} alt={t("qr.title")} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">…</span>
        )}
      </div>
      <p className="mt-3 font-mono text-[10px] tracking-wide text-muted-foreground">{customerId}</p>
    </div>
  );
}
