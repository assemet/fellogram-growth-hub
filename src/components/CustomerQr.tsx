import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { t } from "@/lib/i18n";
import { issueCustomerQr } from "@/lib/qr.functions";

/** The code changes every REFRESH_MS; the database accepts each one for 60 seconds and only once. */
const REFRESH_MS = 30_000;
const LIFETIME_MS = 60_000;

/**
 * The customer's QR. It proves the phone is at the counter right now: the code is random, replaced every
 * 30 seconds and spent by the first stamp, so a screenshot, a forwarded picture or a read-out code does not work.
 */
export function CustomerQr(_props: { customerId?: string }) {
  const issue = useServerFn(issueCustomerQr);
  const [token, setToken] = useState<{ value: string; at: number } | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const loadingRef = useRef(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const { token: value } = await issue();
      setToken({ value, at: Date.now() });
      setFailed(false);
    } catch (error) {
      console.error(error);
      setFailed(true);
    } finally {
      loadingRef.current = false;
    }
  }, [issue]);

  // First code on mount, then a new one every 30 seconds while the screen is visible.
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      const current = tokenRef.current;
      if (document.visibilityState === "visible" && (!current || Date.now() - current.at > REFRESH_MS - 5_000)) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Countdown clock.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(`fellogram:q:${token.value}`, {
        width: 512,
        margin: 1,
        color: { dark: "#1c1a17", light: "#ffffff" },
      });
      if (!cancelled) setSrc(url);
    })().catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const age = token ? now - token.at : 0;
  const expired = Boolean(token) && age >= LIFETIME_MS;
  const secondsLeft = token ? Math.max(0, Math.ceil((REFRESH_MS - age) / 1000)) : 0;
  const progress = token ? Math.min(100, Math.max(0, (age / REFRESH_MS) * 100)) : 0;

  return (
    <div className="surface-glass rounded-lg border border-border p-5 text-center shadow-[var(--shadow-card)]">
      <p className="font-display text-base font-bold">{t("qr.title")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("qr.subtitle")}</p>
      <div className="relative mx-auto mt-4 flex h-60 w-60 items-center justify-center rounded-xl bg-white p-3 ring-1 ring-border">
        {src && !expired ? (
          <img src={src} alt={t("qr.title")} className="h-full w-full object-contain" />
        ) : (
          <span className="px-3 text-xs text-muted-foreground">{failed || expired ? t("qr.failed") : "…"}</span>
        )}
      </div>
      {failed || expired ? (
        <button type="button" onClick={() => void refresh()} className="touch-action mt-3 h-11 rounded-md border border-border px-5 text-sm font-semibold">
          {t("qr.retry")}
        </button>
      ) : (
        <div className="mx-auto mt-3 w-60">
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={t("qr.renews", { count: secondsLeft })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(100 - progress)}>
            <div className="h-full rounded-full bg-foreground/70 transition-[width] duration-500 ease-linear" style={{ width: `${100 - progress}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{t("qr.renews", { count: secondsLeft })}</p>
        </div>
      )}
    </div>
  );
}
