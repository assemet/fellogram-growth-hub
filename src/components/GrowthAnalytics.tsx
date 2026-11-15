import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BellRing, Gift, Stamp, TrendingUp, Users } from "lucide-react";

import { t } from "@/lib/i18n";
import { getStoreImpact } from "@/lib/insights.functions";
import { getStoreAnalytics } from "@/lib/store.functions";

/** "+3", "−2" or "no change" against the period before, with a real minus sign. */
function trendText(now: number, prev: number, days: number): string {
  const diff = now - prev;
  // A left-to-right isolate keeps the sign in front of the number inside Arabic lines.
  const delta = diff === 0 ? t("analytics.same") : diff > 0 ? `\u2066+${diff}\u2069` : `\u2066\u2212${Math.abs(diff)}\u2069`;
  return t("analytics.trend", { delta, days });
}

function Metric({ icon, label, value, sub, trend }: { icon: React.ReactNode; label: string; value: number; sub: string; trend?: string | undefined }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">{icon}</span>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground/60" />
      </div>
      <p className="mt-4 text-3xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-bold">{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{sub}</p>
      {trend && <p className="mt-1 text-xs font-semibold text-foreground/70">{trend}</p>}
    </div>
  );
}

export function GrowthAnalytics() {
  const load = useServerFn(getStoreAnalytics);
  const { data: a } = useQuery({ queryKey: ["store-analytics"], queryFn: () => load() });
  // The comparison with the period before and the win-back numbers come from one database function. If it is not
  // installed yet, those lines are simply left out.
  const loadImpact = useServerFn(getStoreImpact);
  const { data: impactData } = useQuery({ queryKey: ["store-impact"], queryFn: () => loadImpact(), staleTime: 60_000 });
  const impact = impactData?.supported ? impactData.impact : null;
  if (!a) return <div className="mt-4 h-40 animate-pulse rounded-lg bg-muted" />;
  const verdict =
    a.visits === 0
      ? "analytics.verdict.none"
      : a.returning > 0 && a.newCustomers > 0
        ? "analytics.verdict.yes"
        : "analytics.verdict.partial";
  return (
    <section className="mt-7 animate-arrive">
      <div className="flex items-end justify-between gap-3 border-b border-border pb-3">
        <h2 className="max-w-[17rem] text-xl font-bold leading-tight">{t("analytics.title")}</h2>
        <p className="max-w-24 text-end text-xs text-muted-foreground">{t("analytics.period")}</p>
      </div>
      <p className="mt-4 border-l-2 border-growth bg-growth/10 px-4 py-3 text-sm font-semibold leading-snug text-foreground">{t(verdict)}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-bold text-muted-foreground">{t("analytics.repeat.title")}</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-primary">{a.repeatPct}%</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={t("analytics.repeat.title")} aria-valuenow={a.repeatPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.min(100, a.repeatPct)}%` }} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("analytics.repeat.body", { pct: a.repeatPct })}</p>
          {impact && (
            <p className="mt-1 text-xs font-semibold text-foreground/70">
              {t("analytics.returning30", { count: impact.returning.now })} · {trendText(impact.returning.now, impact.returning.prev, impact.days)}
            </p>
          )}
        </div>
        <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-bold text-muted-foreground">{t("analytics.new.title")}</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-growth">{`\u2066+${a.newCustomers}\u2069`}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={t("analytics.new.title")} aria-valuenow={a.referred30} aria-valuemin={0} aria-valuemax={Math.max(1, a.newCustomers)}>
            <div className="h-full rounded-full bg-growth transition-[width] duration-500" style={{ width: `${a.newCustomers ? Math.min(100, (a.referred30 / a.newCustomers) * 100) : 0}%` }} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("analytics.new.body", { count: a.newCustomers, ref: a.referred30 })}</p>
          {impact && <p className="mt-1 text-xs font-semibold text-foreground/70">{trendText(impact.newCustomers.now, impact.newCustomers.prev, impact.days)}</p>}
        </div>
      </div>

      {impact && (
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground" aria-hidden="true">
            <BellRing className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-muted-foreground">{t("analytics.winback.label")}</p>
            {impact.reminded > 0 ? (
              <>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                  <span className={`text-2xl font-extrabold tabular-nums ${impact.wonBack > 0 ? "text-growth" : "text-foreground"}`}>{impact.wonBack}</span>{" "}
                  {t("analytics.winback.sub", { reminded: impact.reminded })}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("analytics.winback.note")}</p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">{t("analytics.winback.none")}</p>
                <Link to="/merchant/customers" className="touch-action mt-1 inline-block text-sm font-semibold text-primary">
                  {t("analytics.winback.action")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Metric icon={<Users className="h-4 w-4" />} label={t("analytics.customers")} value={a.customers}
          sub={t("analytics.customers.split", { new: a.newCustomers, returning: a.returning })} />
        <Metric icon={<Stamp className="h-4 w-4" />} label={t("analytics.visits")} value={a.visits}
          sub={`${t("analytics.visits.split", { visits: a.visits, stamps: a.stamps })} · ${t("analytics.last30", { count: a.visits30 })}`}
          trend={impact ? trendText(impact.visits.now, impact.visits.prev, impact.days) : undefined} />
        <Metric icon={<Gift className="h-4 w-4" />} label={t("analytics.rewards")} value={a.rewardsRedeemed}
          sub={impact ? `${t("analytics.rewards.split", { count: a.rewards30 })} · ${t("analytics.offersUsed", { count: impact.offersUsed })}` : t("analytics.rewards.split", { count: a.rewards30 })} />
        <Metric icon={<TrendingUp className="h-4 w-4" />} label={t("analytics.referrals")} value={a.referred}
          sub={t("analytics.referrals.split", { qualified: a.qualified, rate: a.conversionPct })} />
      </div>
    </section>
  );
}
