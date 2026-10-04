import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Gift, ScanLine, Undo2 } from "lucide-react";

import { AppHeader } from "@/components/BrandMark";
import { SplashScreen } from "@/components/SplashScreen";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { awardStamp, getCashierStore, lookupCustomer, redeemRewardToken, undoLastStamp } from "@/lib/cashier.functions";

export const Route = createFileRoute("/cashier")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cashier mode — Fellogram" },
      { name: "description", content: "Staff-only cashier mode: scan a customer and award a stamp in seconds." },
      { property: "og:title", content: "Cashier mode — Fellogram" },
      { property: "og:description", content: "Fast, staff-only stamping for Fellogram loyalty programs." },
    ],
  }),
  component: Cashier,
});

type CustomerState = {
  customerId: string;
  name: string;
  stampBalance: number;
  stampsRequired: number;
  cooldownMinutesLeft: number;
  canUndo: boolean;
};

function friendlyError(message: string): string {
  if (message.includes("COOLDOWN_ACTIVE")) {
    const minutes = message.split("COOLDOWN_ACTIVE:")[1]?.match(/\d+/)?.[0] ?? "15";
    return t("cashier.cooldown", { count: minutes });
  }
  if (message.includes("MEMBERSHIP_NOT_FOUND")) return t("cashier.notMember");
  if (message.includes("INVALID_CODE")) return t("cashier.invalidCode");
  if (message.includes("TOKEN_USED")) return t("cashier.tokenUsed");
  if (message.includes("TOKEN_EXPIRED")) return t("cashier.tokenExpired");
  if (message.includes("TOKEN_INVALID")) return t("cashier.tokenInvalid");
  if (message.includes("NOT_ENOUGH_STAMPS")) return t("rewards.notEnough");
  if (message.includes("NOTHING_TO_UNDO")) return t("cashier.nothingToUndo");
  return t("common.error");
}

function Cashier() {
  const { state } = useFellogramAuth();
  const loadStore = useServerFn(getCashierStore);
  const findCustomer = useServerFn(lookupCustomer);
  const stamp = useServerFn(awardStamp);
  const undo = useServerFn(undoLastStamp);
  const redeemFn = useServerFn(redeemRewardToken);
  const [mode, setMode] = useState<"customer" | "reward">("customer");

  const [customer, setCustomer] = useState<CustomerState | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null);

  const { data: store, isLoading } = useQuery({
    queryKey: ["cashier-store"],
    queryFn: () => loadStore(),
    enabled: state === "ready",
  });

  const stopScanner = () => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => stopScanner(), []);

  const lookup = useMutation({
    mutationFn: (raw: string) => findCustomer({ data: { code: raw } }),
    onSuccess: (data) => {
      setCustomer(data);
      setError(null);
      setMessage(null);
    },
    onError: (e: Error) => setError(friendlyError(e.message)),
  });

  const award = useMutation({
    mutationFn: (customerId: string) => stamp({ data: { customerId } }),
    onSuccess: (data) => {
      setCustomer(data);
      setError(null);
      setMessage(t("cashier.awarded"));
    },
    onError: (e: Error) => setError(friendlyError(e.message)),
  });

  const reverse = useMutation({
    mutationFn: (customerId: string) => undo({ data: { customerId } }),
    onSuccess: (data) => {
      setCustomer(data);
      setError(null);
      setMessage(t("cashier.undone"));
    },
    onError: (e: Error) => setError(friendlyError(e.message)),
  });

  const redeem = useMutation({
    mutationFn: async (raw: string) => {
      const res = await redeemFn({ data: { code: raw } });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: (data) => {
      if (data.customer) setCustomer(data.customer);
      setError(null);
      setCode("");
      setMessage(t("cashier.redeemed", { reward: data.rewardName, count: data.stampsDeducted }));
    },
    onError: (e: Error) => {
      setMessage(null);
      setError(friendlyError(e.message));
    },
  });

  // QR prefix decides the action, so either scan button works for either code.
  const handleCode = (raw: string) => {
    const value = raw.trim();
    if (value.startsWith("fellogram:r:") || (mode === "reward" && !value.startsWith("fellogram:c:"))) {
      redeem.mutate(value);
    } else {
      lookup.mutate(value);
    }
  };

  const startScanner = async (nextMode: "customer" | "reward" = "customer") => {
    setMode(nextMode);
    setError(null);
    setScanning(true);
    try {
      const QrScanner = (await import("qr-scanner")).default;
      if (!videoRef.current) return;
      const scanner = new QrScanner(
        videoRef.current,
        (result: { data: string }) => {
          stopScanner();
          setCode(result.data);
          handleCode(result.data);
        },
        { highlightScanRegion: true, maxScansPerSecond: 5 },
      );
      scannerRef.current = scanner as unknown as { stop: () => void; destroy: () => void };
      await scanner.start();
    } catch (e) {
      console.error(e);
      stopScanner();
      setError(t("cashier.cameraError"));
    }
  };

  if (state !== "ready" || isLoading) return <SplashScreen />;

  // Strict role isolation: cashier mode is only for store staff/owners.
  if (!store) {
    return (
      <main className="min-h-screen">
        <AppHeader />
        <section className="app-shell rounded-3xl bg-card p-6 text-center shadow-[var(--shadow-card)]">
          <p className="font-semibold">{t("cashier.title")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("cashier.denied")}</p>
          <Link to="/wallet" className="mt-4 inline-block text-sm font-semibold text-primary">
            {t("merchant.switchToWallet")}
          </Link>
        </section>
      </main>
    );
  }

  const ready = customer ? customer.stampBalance >= customer.stampsRequired : false;

  return (
    <main className="min-h-screen pb-10">
      <AppHeader subtitle={`${t("cashier.title")} · ${store.storeName}`} />

      <section className="app-shell space-y-4">
        {!customer && (
          <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
            <div className={scanning ? "overflow-hidden rounded-2xl bg-black" : "hidden"}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} className="aspect-square w-full object-cover" playsInline muted />
            </div>

            {scanning ? (
              <>
                <p className="mt-3 text-center text-sm text-muted-foreground">{t("cashier.scanning")}</p>
                <button
                  type="button"
                  onClick={stopScanner}
                  className="mt-3 w-full rounded-full border border-border py-3 text-sm font-semibold"
                >
                  {t("cashier.stop")}
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => startScanner("customer")}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-base font-bold text-primary-foreground"
                >
                  <Camera className="h-5 w-5" />
                  {t("cashier.scan")}
                </button>
                <button
                  type="button"
                  onClick={() => startScanner("reward")}
                  className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary py-4 text-base font-bold text-primary"
                >
                  <Gift className="h-5 w-5" />
                  {t("cashier.scanReward")}
                </button>
              </div>
            )}

            <form
              className="mt-5 border-t border-border pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleCode(code);
              }}
            >
              <label htmlFor="code" className="text-xs font-semibold text-muted-foreground">
                {t("cashier.manual")}
              </label>
              <input
                id="code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder={t("cashier.manualPlaceholder")}
                className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-3 font-mono text-xs"
              />
              <button
                type="submit"
                disabled={lookup.isPending || redeem.isPending || code.trim().length === 0}
                className="mt-3 w-full rounded-full bg-secondary py-3 text-sm font-semibold text-secondary-foreground disabled:opacity-50"
              >
                {lookup.isPending || redeem.isPending
                  ? t("cashier.searching")
                  : mode === "reward" || code.trim().startsWith("fellogram:r:")
                    ? t("cashier.redeem")
                    : t("cashier.find")}
              </button>
            </form>
          </div>
        )}

        {customer && (
          <div className="rounded-3xl bg-card p-5 text-center shadow-[var(--shadow-card)]">
            <ScanLine className="mx-auto h-6 w-6 text-primary" />
            <p className="mt-2 font-display text-xl font-bold">{customer.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("cashier.balance", { balance: customer.stampBalance, required: customer.stampsRequired })}
            </p>
            {ready && <p className="mt-2 text-sm font-semibold text-primary">{t("cashier.rewardReady")}</p>}

            <button
              type="button"
              onClick={() => award.mutate(customer.customerId)}
              disabled={award.isPending || customer.cooldownMinutesLeft > 0}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-5 text-lg font-bold text-primary-foreground disabled:opacity-50"
            >
              <Check className="h-5 w-5" />
              {award.isPending ? t("cashier.awarding") : t("cashier.award")}
            </button>

            {customer.cooldownMinutesLeft > 0 && (
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                {t("cashier.cooldown", { count: customer.cooldownMinutesLeft })}
              </p>
            )}

            {customer.canUndo && (
              <button
                type="button"
                onClick={() => reverse.mutate(customer.customerId)}
                disabled={reverse.isPending}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-semibold disabled:opacity-50"
              >
                <Undo2 className="h-4 w-4" />
                {reverse.isPending ? t("cashier.undoing") : t("cashier.undo")}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setCustomer(null);
                setCode("");
                setMessage(null);
                setError(null);
              }}
              className="mt-4 text-sm font-semibold text-primary"
            >
              {t("cashier.reset")}
            </button>
          </div>
        )}

        {message && (
          <p className="rounded-2xl bg-secondary px-4 py-3 text-center text-sm font-semibold text-secondary-foreground">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-center text-sm font-semibold text-destructive">
            {error}
          </p>
        )}

        <Link to="/merchant" className="block text-center text-sm font-semibold text-primary">
          {t("merchant.title")}
        </Link>
      </section>
    </main>
  );
}
