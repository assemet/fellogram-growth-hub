import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Megaphone, Ticket, Zap } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/BrandMark";
import { BackLink } from "@/components/BackLink";
import { QueryError } from "@/components/QueryError";
import { SplashScreen } from "@/components/SplashScreen";
import { Button } from "@/components/ui/button";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { promoStatus, wasStopped, toLocalInput, type PromoStatus } from "@/lib/promotions";
import { deletePromotion, getPromotions, reactivatePromotion, saveOffer, saveStampEvent, stopPromotion } from "@/lib/promotions.functions";

export const Route = createFileRoute("/merchant/promotions")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Promotions — Fellogram" },
      { name: "description", content: "Double-stamp events and limited-time offers for your customers." },
      { property: "og:title", content: "Promotions — Fellogram" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PromotionsPage,
});

const inputClass = "mt-1 w-full rounded-md border border-border bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function friendly(message: string) {
  if (message.includes("INVALID_DATES") || message.includes("_window")) return t("promo.invalidDates");
  if (message.includes("PROMO_EXPIRED")) return t("promo.expiredNow");
  if (message.includes("OFFER_HAS_USES")) return t("promo.keptHistory");
  return t("common.error");
}

function defaultWindow() {
  const start = new Date();
  start.setSeconds(0, 0);
  return { start: toLocalInput(start), end: toLocalInput(new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)) };
}

function StatusPill({ status }: { status: PromoStatus }) {
  const style = status === "live" ? "bg-growth/15 text-foreground" : status === "soon" ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${style}`}>{t(`promo.status.${status}`)}</span>;
}

function DateTimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [date = "", time = ""] = value.split("T");
  const set = (d: string, tm: string) => onChange(`${d}T${tm || "00:00"}`);
  return (
    <fieldset className="rounded-md border border-border p-3">
      <legend className="px-1 text-xs font-bold">{label}</legend>
      <div className="grid grid-cols-1 gap-2 min-[28rem]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="text-[11px] font-semibold text-muted-foreground">
          {t("promo.date")}
          <input type="date" value={date} onChange={(e) => set(e.target.value, time)} className={inputClass} />
        </label>
        <label className="text-[11px] font-semibold text-muted-foreground">
          {t("promo.time")}
          <input type="time" value={time} onChange={(e) => set(date, e.target.value)} className={inputClass} />
        </label>
      </div>
    </fieldset>
  );
}

function WindowFields({ start, end, onStart, onEnd }: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void }) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const valid = !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate > startDate;
  return (
    <div className="space-y-3">
      <DateTimeField label={t("promo.starts")} value={start} onChange={onStart} />
      <DateTimeField label={t("promo.ends")} value={end} onChange={onEnd} />
      <p className={`text-xs font-semibold ${valid ? "text-primary" : "text-destructive"}`} role="status">
        {valid ? t("promo.summary", { from: formatDateTime(startDate.toISOString()), to: formatDateTime(endDate.toISOString()) }) : t("promo.invalidDates")}
      </p>
    </div>
  );
}

function PromotionsPage() {
  const { state } = useFellogramAuth();
  const queryClient = useQueryClient();
  const load = useServerFn(getPromotions);
  const createEvent = useServerFn(saveStampEvent);
  const createOffer = useServerFn(saveOffer);
  const stop = useServerFn(stopPromotion);
  const reactivate = useServerFn(reactivatePromotion);
  const remove = useServerFn(deletePromotion);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["promotions"], queryFn: () => load(), enabled: state === "ready" });

  const initial = defaultWindow();
  const [eventName, setEventName] = useState("");
  const [multiplier, setMultiplier] = useState(2);
  const [eventStart, setEventStart] = useState(initial.start);
  const [eventEnd, setEventEnd] = useState(initial.end);
  const [offerTitle, setOfferTitle] = useState("");
  const [offerDetails, setOfferDetails] = useState("");
  const [offerStart, setOfferStart] = useState(initial.start);
  const [offerEnd, setOfferEnd] = useState(initial.end);
  const [confirmStop, setConfirmStop] = useState<string | null>(null);

  // "Tap again to stop" lapses on its own.
  useEffect(() => {
    if (!confirmStop) return;
    const id = setTimeout(() => setConfirmStop(null), 4000);
    return () => clearTimeout(id);
  }, [confirmStop]);

  const done = async (message: string) => {
    toast.success(message);
    // The owner's own wallet and cashier screens must not keep showing what was just stopped or created.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["promotions"] }),
      queryClient.invalidateQueries({ queryKey: ["my-cards"] }),
      queryClient.invalidateQueries({ queryKey: ["cashier-store"] }),
    ]);
  };

  const eventMutation = useMutation({
    mutationFn: () => createEvent({ data: { name: eventName, multiplier, startsAt: new Date(eventStart).toISOString(), endsAt: new Date(eventEnd).toISOString() } }),
    onSuccess: async () => {
      setEventName("");
      await done(t("promo.saved"));
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });
  const offerMutation = useMutation({
    mutationFn: () => createOffer({ data: { title: offerTitle, details: offerDetails, startsAt: new Date(offerStart).toISOString(), endsAt: new Date(offerEnd).toISOString() } }),
    onSuccess: async () => {
      setOfferTitle("");
      setOfferDetails("");
      await done(t("promo.saved"));
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });
  const stopMutation = useMutation({
    mutationFn: (input: { kind: "event" | "offer"; id: string }) => stop({ data: input }),
    onSuccess: async () => {
      setConfirmStop(null);
      await done(t("promo.stopped"));
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });

  const reactivateMutation = useMutation({
    mutationFn: (input: { kind: "event" | "offer"; id: string }) => reactivate({ data: input }),
    onSuccess: async () => {
      await done(t("promo.reactivated"));
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });
  const deleteMutation = useMutation({
    mutationFn: (input: { kind: "event" | "offer"; id: string }) => remove({ data: input }),
    onSuccess: async () => {
      setConfirmStop(null);
      await done(t("promo.deleted"));
    },
    onError: (e: Error) => {
      setConfirmStop(null);
      toast.error(friendly(e.message));
    },
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (state !== "ready" || isLoading || !data) return <SplashScreen />;

  const stopButton = (kind: "event" | "offer", id: string) => (
    <Button
      type="button"
      variant={confirmStop === id ? "destructive" : "outline"}
      size="sm"
      disabled={stopMutation.isPending}
      className="touch-action h-10 shrink-0 px-3 text-xs font-semibold"
      onClick={() => (confirmStop === id ? stopMutation.mutate({ kind, id }) : setConfirmStop(id))}
    >
      {confirmStop === id ? t("promo.stop.confirm") : t("promo.stop")}
    </Button>
  );

  // What can still be done with something that is no longer running.
  const endedActions = (kind: "event" | "offer", promo: { id: string; active: boolean; startsAt: string; endsAt: string }, canDelete: boolean) => (
    <div className="flex shrink-0 flex-col gap-1.5">
      {wasStopped(promo) && (
        <Button type="button" variant="outline" size="sm" disabled={reactivateMutation.isPending} className="touch-action h-10 px-3 text-xs font-semibold" onClick={() => reactivateMutation.mutate({ kind, id: promo.id })}>
          {t("promo.reactivate")}
        </Button>
      )}
      {canDelete && (
        <Button
          type="button"
          variant={confirmStop === `del:${promo.id}` ? "destructive" : "ghost"}
          size="sm"
          disabled={deleteMutation.isPending}
          className="touch-action h-10 px-3 text-xs font-semibold"
          onClick={() => (confirmStop === `del:${promo.id}` ? deleteMutation.mutate({ kind, id: promo.id }) : setConfirmStop(`del:${promo.id}`))}
        >
          {confirmStop === `del:${promo.id}` ? t("promo.delete.confirm") : t("promo.delete")}
        </Button>
      )}
    </div>
  );

  return (
    <main className="min-h-screen pb-14">
      <AppHeader subtitle={data.storeName} />
      <section className="app-shell">
        <BackLink to="/merchant">{t("merchant.title")}</BackLink>
        <h1 className="mt-3 flex items-center gap-2 text-xl font-bold">
          <Megaphone className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("promo.title")}
        </h1>

        <div className="mt-5 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Zap className="h-4 w-4 text-primary" aria-hidden="true" />{t("promo.events")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("promo.events.hint")}</p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              eventMutation.mutate();
            }}
          >
            <label className="block text-xs font-semibold text-muted-foreground">
              {t("promo.event.name")}
              <input value={eventName} onChange={(e) => setEventName(e.target.value)} maxLength={60} placeholder={t("promo.event.namePlaceholder")} className={inputClass} />
            </label>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{t("promo.event.multiplier")}</p>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMultiplier(n)}
                    aria-pressed={multiplier === n}
                    className={`touch-action h-11 rounded-md border text-sm font-bold ${multiplier === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
                  >
                    ×{n}
                  </button>
                ))}
              </div>
            </div>
            <WindowFields start={eventStart} end={eventEnd} onStart={setEventStart} onEnd={setEventEnd} />
            <Button type="submit" disabled={eventMutation.isPending || eventName.trim().length < 2 || !(new Date(eventEnd) > new Date(eventStart))} className="touch-action h-12 w-full font-bold">
              {t("promo.event.create")}
            </Button>
          </form>

          {data.events.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-border pt-3">
              {data.events.map((event) => {
                const status = promoStatus(event);
                return (
                  <li key={event.id} className="flex items-center gap-2 rounded-md bg-secondary p-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold"><span className="truncate">{event.name} · ×{event.multiplier}</span><StatusPill status={status} /></p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(event.startsAt)} → {formatDateTime(event.endsAt)}</p>
                    </div>
                    {status !== "ended" ? stopButton("event", event.id) : endedActions("event", event, true)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-5 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Ticket className="h-4 w-4 text-primary" aria-hidden="true" />{t("promo.offers")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("promo.offers.hint")}</p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              offerMutation.mutate();
            }}
          >
            <label className="block text-xs font-semibold text-muted-foreground">
              {t("promo.offer.title")}
              <input value={offerTitle} onChange={(e) => setOfferTitle(e.target.value)} maxLength={80} placeholder={t("promo.offer.titlePlaceholder")} className={inputClass} />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              {t("promo.offer.details")}
              <input value={offerDetails} onChange={(e) => setOfferDetails(e.target.value)} maxLength={300} className={inputClass} />
            </label>
            <WindowFields start={offerStart} end={offerEnd} onStart={setOfferStart} onEnd={setOfferEnd} />
            <Button type="submit" disabled={offerMutation.isPending || offerTitle.trim().length < 2 || !(new Date(offerEnd) > new Date(offerStart))} className="touch-action h-12 w-full font-bold">
              {t("promo.offer.create")}
            </Button>
          </form>

          {data.offers.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-border pt-3">
              {data.offers.map((offer) => {
                const status = promoStatus(offer);
                return (
                  <li key={offer.id} className="flex items-center gap-2 rounded-md bg-secondary p-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold"><span className="truncate">{offer.title}</span><StatusPill status={status} /></p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(offer.startsAt)} → {formatDateTime(offer.endsAt)} · {t("promo.used", { count: offer.used })}</p>
                      {status === "ended" && offer.used > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{t("promo.keptHistory")}</p>}
                    </div>
                    {status !== "ended" ? stopButton("offer", offer.id) : endedActions("offer", offer, offer.used === 0)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
