import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, Gift, ScanLine, Undo2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { AppHeader } from "@/components/BrandMark";
import { QueryError } from "@/components/QueryError";
import { SplashScreen } from "@/components/SplashScreen";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { awardStamp, enrollCustomer, getCashierStore, lookupCustomer, redeemRewardToken, searchCustomers, undoLastStamp } from "@/lib/cashier.functions";
import { notify, primeAudio } from "@/lib/feedback";

export const Route = createFileRoute("/cashier")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cashier mode — Fellogram" },
      { name: "description", content: "Staff-only cashier mode: scan a customer and award a stamp in seconds." },
      { property: "og:title", content: "Cashier mode — Fellogram" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Fast, staff-only stamping for Fellogram loyalty programs." },
    ],
  }),
  component: Cashier,
});

type CustomerState = {
  newCustomer?: false;
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
  if (message.includes("INVALID_CODE") || message.includes("CUSTOMER_NOT_FOUND")) return t("cashier.invalidCode");
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
  const enrollFn = useServerFn(enrollCustomer);
  const searchFn = useServerFn(searchCustomers);
  const [mode, setMode] = useState<"customer" | "reward">("customer");

  const [customer, setCustomer] = useState<CustomerState | null>(null);
  const [newCustomerId, setNewCustomerId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [autoStamp, setAutoStamp] = useState(true);
  const [justStamped, setJustStamped] = useState(false);
  const [returnIn, setReturnIn] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const autoStampRef = useRef(true);
  const viaCameraRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null);

  const { data: store, isLoading, error: storeError, refetch: refetchStore } = useQuery({
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

  // Auto-stamp preference is remembered on this device.
  useEffect(() => {
    try {
      if (window.localStorage.getItem("fellogram.autoStamp") === "0") setAutoStamp(false);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);
  autoStampRef.current = autoStamp;

  const toggleAutoStamp = (value: boolean) => {
    setAutoStamp(value);
    try {
      window.localStorage.setItem("fellogram.autoStamp", value ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  // After a successful auto-stamp, return to the scanner on its own so the queue keeps moving.
  useEffect(() => {
    if (returnIn === null) return;
    if (returnIn <= 0) {
      nextCustomer(true);
      return;
    }
    const id = setTimeout(() => setReturnIn((n) => (n === null ? null : n - 1)), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnIn]);

  // Name search for the manual lookup (no more typing long ids).
  useEffect(() => {
    const id = setTimeout(() => setNameQuery(nameInput.trim()), 300);
    return () => clearTimeout(id);
  }, [nameInput]);
  const { data: nameResults, isFetching: searchingNames } = useQuery({
    queryKey: ["cashier-search", nameQuery],
    queryFn: () => searchFn({ data: { q: nameQuery } }),
    enabled: state === "ready" && nameQuery.length >= 2,
  });

  const lookup = useMutation({
    mutationFn: (raw: string) => findCustomer({ data: { code: raw } }),
    onSuccess: (data) => {
      setError(null);
      setMessage(null);
      if (data.newCustomer) {
        // Valid customer QR but no card here yet: offer to create it on the spot.
        setCustomer(null);
        setNewCustomerId(data.customerId);
        return;
      }
      setNewCustomerId(null);
      setCustomer(data);
      setJustStamped(false);
      if (data.cooldownMinutesLeft > 0) {
        notify("warning");
      } else if (autoStampRef.current) {
        // Scan → stamp → done: no extra tap needed.
        award.mutate(data.customerId);
      }
    },
    onError: (e: Error) => {
      notify("error");
      setError(friendlyError(e.message));
    },
  });

  const enroll = useMutation({
    mutationFn: (customerId: string) => enrollFn({ data: { customerId } }),
    onSuccess: (data) => {
      setCustomer(data);
      setNewCustomerId(null);
      setError(null);
      setMessage(t("cashier.enrolled"));
      setJustStamped(true);
      notify("success");
      if (autoStampRef.current) setReturnIn(4);
    },
    onError: (e: Error) => {
      notify("error");
      setError(friendlyError(e.message));
    },
  });

  const award = useMutation({
    mutationFn: (customerId: string) => stamp({ data: { customerId } }),
    onSuccess: (data) => {
      setCustomer(data);
      setError(null);
      setMessage(null);
      setJustStamped(true);
      notify("success");
      if (autoStampRef.current) setReturnIn(4);
    },
    onError: (e: Error) => {
      notify("error");
      setError(friendlyError(e.message));
    },
  });

  const reverse = useMutation({
    mutationFn: (customerId: string) => undo({ data: { customerId } }),
    onSuccess: (data) => {
      setCustomer(data);
      setError(null);
      setJustStamped(false);
      setReturnIn(null);
      setMessage(t("cashier.undone"));
      notify("warning");
      toast.message(t("cashier.undone"));
    },
    onError: (e: Error) => {
      notify("error");
      setError(friendlyError(e.message));
    },
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
      setJustStamped(false);
      notify("success");
      setCode("");
      setMessage(t("cashier.redeemed", { reward: data.rewardName, count: data.stampsDeducted }));
      toast.success(t("cashier.redeemed", { reward: data.rewardName, count: data.stampsDeducted }));
    },
    onError: (e: Error) => {
      notify("error");
      setMessage(null);
      setError(friendlyError(e.message));
    },
  });

  // QR prefix decides the action, so either scan button works for either code.
  const handleCode = (raw: string, forcedMode: "customer" | "reward" = mode) => {
    const value = raw.trim();
    if (value.startsWith("fellogram:r:") || (forcedMode === "reward" && !value.startsWith("fellogram:c:"))) {
      redeem.mutate(value);
    } else {
      lookup.mutate(value);
    }
  };

  const startScanner = async (nextMode: "customer" | "reward" = "customer") => {
    setMode(nextMode);
    setError(null);
    setScanning(true);
    viaCameraRef.current = true;
    primeAudio();
    try {
      const QrScanner = (await import("qr-scanner")).default;
      // When restarting automatically the video element is re-mounting: wait for it.
      for (let i = 0; i < 20 && !videoRef.current; i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
      if (!videoRef.current) {
        setScanning(false);
        return;
      }
      const scanner = new QrScanner(
        videoRef.current,
        (result: { data: string }) => {
          stopScanner();
          setCode(result.data);
          handleCode(result.data, nextMode);
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

  const nextCustomer = (restartScanner = false) => {
    setCustomer(null);
    setNewCustomerId(null);
    setCode("");
    setNameInput("");
    setMessage(null);
    setError(null);
    setJustStamped(false);
    setReturnIn(null);
    if (restartScanner && viaCameraRef.current) void startScanner("customer");
  };

  if (storeError) return <QueryError error={storeError} onRetry={() => refetchStore()} />;
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
    <main className="min-h-[100dvh] pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      <AppHeader subtitle={`${t("cashier.title")} · ${store.storeName}`} />

      <section className="app-shell space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("cashier.title")}</h1>
          <span className="shrink-0 rounded-md bg-growth/15 px-2.5 py-1 text-xs font-bold text-foreground">{store.storeName}</span>
        </div>
        {!customer && !newCustomerId && (
          <div className="animate-arrive rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className={scanning ? "overflow-hidden rounded-md bg-foreground" : "hidden"}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} className="aspect-square w-full object-cover" playsInline muted />
            </div>

            {scanning ? (
              <>
                <p className="mt-3 text-center text-sm text-muted-foreground">{t("cashier.scanning")}</p>
                <Button
                  type="button"
                  onClick={stopScanner}
                  variant="outline"
                  className="touch-action mt-3 h-12 w-full"
                >
                  {t("cashier.stop")}
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <Button
                  type="button"
                  onClick={() => startScanner("customer")}
                  className="touch-action h-16 w-full gap-2 text-base font-bold shadow-[var(--shadow-float)]"
                >
                  <Camera className="h-5 w-5" />
                  {t("cashier.scan")}
                </Button>
                <Button
                  type="button"
                  onClick={() => startScanner("reward")}
                  variant="outline"
                  className="touch-action h-14 w-full gap-2 border-primary text-base font-bold text-primary"
                >
                  <Gift className="h-5 w-5" />
                  {t("cashier.scanReward")}
                </Button>
              </div>
            )}

            <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={autoStamp}
                onChange={(event) => toggleAutoStamp(event.target.checked)}
                className="h-5 w-5 shrink-0 accent-[var(--primary)]"
              />
              {t("cashier.autoStamp")}
            </label>

            <div className="mt-3 border-t border-border pt-4">
              <label htmlFor="nameSearch" className="text-xs font-semibold text-muted-foreground">
                {t("cashier.search")}
              </label>
              <input
                id="nameSearch"
                type="search"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                placeholder={t("cashier.searchPlaceholder")}
                className="mt-2 w-full rounded-md border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {nameQuery.length >= 2 && !searchingNames && nameResults && nameResults.results.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{t("cashier.searchNone")}</p>
              )}
              {nameResults && nameResults.results.length > 0 && nameQuery.length >= 2 && (
                <ul className="mt-2 space-y-1">
                  {nameResults.results.map((person) => (
                    <li key={person.customerId}>
                      <button
                        type="button"
                        onClick={() => {
                          viaCameraRef.current = false;
                          lookup.mutate(person.customerId);
                        }}
                        className="touch-action flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-3 text-start text-sm"
                      >
                        <span className="min-w-0 truncate font-semibold">{person.name ?? (person.username ? `@${person.username}` : t("customers.anonymous"))}</span>
                        <span className="shrink-0 text-xs font-bold text-muted-foreground">
                          {person.balance}/{person.required}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form
              className="mt-5 border-t border-border pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                viaCameraRef.current = false;
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
                className="mt-2 w-full rounded-md border border-border bg-background px-4 py-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="submit"
                disabled={lookup.isPending || redeem.isPending || code.trim().length === 0}
                variant="secondary"
                className="touch-action mt-3 h-12 w-full font-bold"
              >
                {lookup.isPending || redeem.isPending
                  ? t("cashier.searching")
                  : mode === "reward" || code.trim().startsWith("fellogram:r:")
                    ? t("cashier.redeem")
                    : t("cashier.find")}
              </Button>
            </form>
          </div>
        )}

        {newCustomerId && !customer && (
          <div className="animate-arrive rounded-lg border border-border bg-card p-5 text-center shadow-[var(--shadow-card)]">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent">
              <UserPlus className="h-6 w-6 text-primary" />
            </span>
            <p className="mt-2 font-display text-xl font-bold">{t("cashier.newCustomer.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("cashier.newCustomer.body")}</p>
            <Button
              type="button"
              onClick={() => enroll.mutate(newCustomerId)}
              disabled={enroll.isPending}
              className="touch-action mt-6 h-16 w-full gap-2 text-lg font-bold shadow-[var(--shadow-float)]"
            >
              <Check className="h-5 w-5" />
              {enroll.isPending ? t("cashier.awarding") : t("cashier.newCustomer.action")}
            </Button>
            <Button
              type="button"
              onClick={() => nextCustomer()}
              variant="ghost"
              className="touch-action mt-4 w-full text-sm font-semibold text-primary"
            >
              {t("cashier.reset")}
            </Button>
          </div>
        )}

        {customer && (
          <div className="animate-arrive rounded-lg border border-border bg-card p-5 text-center shadow-[var(--shadow-card)]">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent"><ScanLine className="h-6 w-6 text-primary" /></span>
            <p className="mt-2 font-display text-xl font-bold">{customer.name}</p>
            {justStamped && (
              <div className="mt-4 rounded-md bg-growth/15 px-4 py-5" role="status" aria-live="polite">
                <span className="animate-stamp-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-growth text-growth-foreground">
                  <Check className="h-9 w-9" />
                </span>
                <p className="mt-3 font-display text-2xl font-bold">
                  {t("cashier.stampedBig", { balance: customer.stampBalance, required: customer.stampsRequired })}
                </p>
              </div>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {t("cashier.balance", { balance: customer.stampBalance, required: customer.stampsRequired })}
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={t("cashier.progressLabel")} aria-valuenow={customer.stampBalance} aria-valuemin={0} aria-valuemax={customer.stampsRequired}>
              <div className="h-full rounded-full bg-growth transition-[width] duration-500" style={{ width: `${Math.min(100, customer.stampBalance / Math.max(1, customer.stampsRequired) * 100)}%` }} />
            </div>
            {ready && <p className="mt-2 text-sm font-semibold text-primary">{t("cashier.rewardReady")}</p>}

            {!justStamped && (
              <Button
                type="button"
                onClick={() => award.mutate(customer.customerId)}
                disabled={award.isPending || customer.cooldownMinutesLeft > 0}
                className="touch-action mt-6 h-16 w-full gap-2 text-lg font-bold shadow-[var(--shadow-float)]"
              >
                <Check className="h-5 w-5" />
                {award.isPending ? t("cashier.awarding") : t("cashier.award")}
              </Button>
            )}

            {returnIn !== null && (
              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{t("cashier.backIn", { count: returnIn })}</span>
                <Button type="button" variant="ghost" size="sm" className="touch-action font-semibold" onClick={() => setReturnIn(null)}>
                  {t("cashier.keepOpen")}
                </Button>
              </div>
            )}

            {customer.cooldownMinutesLeft > 0 && (
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                {t("cashier.cooldown", { count: customer.cooldownMinutesLeft })}
              </p>
            )}

            {customer.canUndo && (
              <Button
                type="button"
                onClick={() => {
                  setReturnIn(null);
                  reverse.mutate(customer.customerId);
                }}
                disabled={reverse.isPending}
                variant="outline"
                className="touch-action mt-3 h-12 w-full gap-2 font-semibold"
              >
                <Undo2 className="h-4 w-4" />
                {reverse.isPending ? t("cashier.undoing") : t("cashier.undo")}
              </Button>
            )}

            <Button
              type="button"
              onClick={() => nextCustomer(true)}
              variant="ghost"
              className="touch-action mt-4 w-full text-sm font-semibold text-primary"
            >
              {t("cashier.reset")}
            </Button>
          </div>
        )}

        {message && (
          <p className="animate-arrive rounded-md bg-growth/15 px-4 py-3 text-center text-sm font-semibold text-foreground" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="animate-arrive rounded-md bg-destructive/10 px-4 py-3 text-center text-sm font-semibold text-destructive" role="alert">
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
