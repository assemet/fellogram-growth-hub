import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Gift, Search, Sparkles, Stamp, Undo2, Users } from "lucide-react";

import { AppHeader } from "@/components/BrandMark";
import { QueryError } from "@/components/QueryError";
import { SplashScreen } from "@/components/SplashScreen";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { formatRelative } from "@/lib/format";
import { getStoreActivity, getStoreCustomers } from "@/lib/insights.functions";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/merchant/customers")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Customers — Fellogram" },
      { name: "description", content: "See your customers and recent activity." },
      { property: "og:title", content: "Customers — Fellogram" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { state } = useFellogramAuth();
  const [tab, setTab] = useState<"customers" | "activity">("customers");

  return (
    <main className="min-h-screen pb-14">
      <AppHeader />
      <section className="app-shell">
        <Link to="/merchant" className="touch-action text-sm font-semibold text-primary">
          ← {t("merchant.title")}
        </Link>
        <h1 className="mt-3 text-xl font-bold">{t("dash.customers")}</h1>

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="mt-4">
          <TabsList className="grid h-auto w-full grid-cols-2 p-1">
            <TabsTrigger value="customers" className="touch-action py-2.5 font-semibold">
              {t("customers.title")}
            </TabsTrigger>
            <TabsTrigger value="activity" className="touch-action py-2.5 font-semibold">
              {t("activity.title")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="customers" className="mt-4">
            <CustomersTab ready={state === "ready"} />
          </TabsContent>
          <TabsContent value="activity" className="mt-4">
            <ActivityTab ready={state === "ready"} />
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}

function CustomersTab({ ready }: { ready: boolean }) {
  const load = useServerFn(getStoreCustomers);
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(id);
  }, [input]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["store-customers", q],
    queryFn: () => load({ data: { q } }),
    enabled: ready,
    placeholderData: (previous) => previous,
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (!ready || isLoading || !data) return <SplashScreen />;

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t("customers.search")}
          aria-label={t("customers.search")}
          className="w-full rounded-md border border-border bg-card py-3 ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <p className="mt-3 text-xs font-semibold text-muted-foreground">{t("customers.count", { count: data.total })}</p>

      {data.customers.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {q ? t("customers.noMatch") : t("customers.empty")}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.customers.map((customer) => {
            const label = customer.name ?? (customer.username ? `@${customer.username}` : t("customers.anonymous"));
            const ready = customer.balance >= customer.required;
            const percent = Math.min(100, Math.round((customer.balance / Math.max(1, customer.required)) * 100));
            const last = formatRelative(customer.lastVisitAt);
            return (
              <li key={customer.customerId} className="rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-foreground" aria-hidden="true">
                    {label.replace(/^@/, "").charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {last ? t("customers.lastVisit", { when: last }) : t("customers.never")}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-extrabold ${ready ? "text-growth" : ""}`}>
                    {customer.balance}/{customer.required}
                  </span>
                </div>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"
                  role="progressbar"
                  aria-label={t("cashier.progressLabel")}
                  aria-valuenow={customer.balance}
                  aria-valuemin={0}
                  aria-valuemax={customer.required}
                >
                  <div className={`h-full rounded-full ${ready ? "bg-growth" : "bg-primary"}`} style={{ width: `${percent}%` }} />
                </div>
                {ready && <p className="mt-2 text-xs font-bold text-growth">{t("customers.rewardReady")}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {data.truncated && <p className="mt-3 text-center text-xs text-muted-foreground">{t("customers.truncated", { count: data.customers.length })}</p>}
    </div>
  );
}

const activityMeta = {
  stamp_awarded: { icon: Stamp, key: "activity.stamp", tone: "bg-growth/15 text-growth" },
  stamp_reversed: { icon: Undo2, key: "activity.reversed", tone: "bg-muted text-muted-foreground" },
  reward_redeemed: { icon: Gift, key: "activity.redeemed", tone: "bg-accent text-accent-foreground" },
  referral_reward: { icon: Users, key: "activity.referral", tone: "bg-accent text-accent-foreground" },
  join_bonus: { icon: Sparkles, key: "activity.joinBonus", tone: "bg-growth/15 text-growth" },
} as const;

function ActivityTab({ ready }: { ready: boolean }) {
  const load = useServerFn(getStoreActivity);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["store-activity"],
    queryFn: () => load(),
    enabled: ready,
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (!ready || isLoading || !data) return <SplashScreen />;

  if (data.items.length === 0) {
    return <p className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">{t("activity.empty")}</p>;
  }

  return (
    <ul className="space-y-2">
      {data.items.map((item) => {
        const meta = activityMeta[item.type] ?? activityMeta.stamp_awarded;
        const Icon = meta.icon;
        return (
          <li key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-card)]">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.tone}`} aria-hidden="true">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {t(meta.key)}
                {(item.type === "stamp_awarded" || item.type === "join_bonus") && item.amount > 1 ? ` ×${item.amount}` : ""}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {item.customerName ?? t("customers.anonymous")}
                {item.staffName ? ` · ${t("activity.by", { name: item.staffName })}` : ""}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(item.createdAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}
