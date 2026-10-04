import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Stamp, TrendingUp, Users } from "lucide-react";

import { t } from "@/lib/i18n";
import { getStoreAnalytics } from "@/lib/store.functions";

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub: string }) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent text-accent-foreground">{icon}</span>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

export function GrowthAnalytics() {
  const load = useServerFn(getStoreAnalytics);
  const { data: a } = useQuery({ queryKey: ["store-analytics"], queryFn: () => load() });
  if (!a) return <div className="mt-4 h-40 animate-pulse rounded-3xl bg-muted" />;
  const verdict =
    a.visits === 0
      ? "analytics.verdict.none"
      : a.returning > 0 && a.newCustomers > 0
        ? "analytics.verdict.yes"
        : "analytics.verdict.partial";
  return (
    <section className="mt-5">
      <h2 className="text-lg font-bold">{t("analytics.title")}</h2>
      <p className="text-xs text-muted-foreground">{t("analytics.period")}</p>
      <p className="mt-2 rounded-2xl bg-accent p-3 text-sm font-semibold text-accent-foreground">{t(verdict)}</p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold text-muted-foreground">{t("analytics.repeat.title")}</p>
          <p className="mt-1 text-3xl font-bold text-primary">{a.repeatPct}%</p>
          <p className="text-xs text-muted-foreground">{t("analytics.repeat.body", { pct: a.repeatPct })}</p>
        </div>
        <div className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold text-muted-foreground">{t("analytics.new.title")}</p>
          <p className="mt-1 text-3xl font-bold text-primary">+{a.newCustomers}</p>
          <p className="text-xs text-muted-foreground">{t("analytics.new.body", { count: a.newCustomers, ref: a.referred30 })}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Metric icon={<Users className="h-4 w-4" />} label={t("analytics.customers")} value={a.customers}
          sub={t("analytics.customers.split", { new: a.newCustomers, returning: a.returning })} />
        <Metric icon={<Stamp className="h-4 w-4" />} label={t("analytics.visits")} value={a.visits}
          sub={`${t("analytics.visits.split", { visits: a.visits, stamps: a.stamps })} · ${t("analytics.last30", { count: a.visits30 })}`} />
        <Metric icon={<Gift className="h-4 w-4" />} label={t("analytics.rewards")} value={a.rewardsRedeemed}
          sub={t("analytics.rewards.split", { count: a.rewards30 })} />
        <Metric icon={<TrendingUp className="h-4 w-4" />} label={t("analytics.referrals")} value={a.referred}
          sub={t("analytics.referrals.split", { qualified: a.qualified, rate: a.conversionPct })} />
      </div>
    </section>
  );
}
