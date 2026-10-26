import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppHeader } from "@/components/BrandMark";
import { QueryError } from "@/components/QueryError";
import { SplashScreen } from "@/components/SplashScreen";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { getMyStore } from "@/lib/store.functions";
import { GrowthAnalytics } from "@/components/GrowthAnalytics";
import { StoreJoinShare } from "@/components/StoreJoinShare";
import { ArrowRight, ChevronRight, Settings2, Store, UserPlus, Users } from "lucide-react";

export const Route = createFileRoute("/merchant/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Store dashboard — Fellogram" },
      { name: "description", content: "See customers, visits, rewards and referral growth for your store." },
      { property: "og:title", content: "Store dashboard — Fellogram" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Is loyalty growing your business? Find out in one screen." },
    ],
  }),
  component: MerchantDashboard,
});

function MerchantDashboard() {
  const { state } = useFellogramAuth();
  const loadStore = useServerFn(getMyStore);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-store"],
    queryFn: () => loadStore(),
    enabled: state === "ready",
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (state !== "ready" || isLoading) return <SplashScreen />;

  if (!data) {
    return (
      <main className="min-h-screen">
        <AppHeader />
        <section className="app-shell rounded-3xl bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <p className="font-semibold">{t("wallet.merchantCta.title")}</p>
          <Link
            to="/merchant/new"
            className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            {t("wallet.merchantCta.action")}
          </Link>
        </section>
      </main>
    );
  }

  const reward = data.rewards[0]?.name ?? "—";

  return (
    <main className="min-h-screen pb-14">
      <AppHeader />

      <section className="app-shell">
        <h1 className="mb-4 text-sm font-bold uppercase text-muted-foreground">{t("merchant.title")}</h1>

        <div className="brand-surface animate-arrive rounded-lg p-5 shadow-[var(--shadow-float)]">
          <p className="break-words font-display text-3xl font-bold leading-tight">{data.store.name}</p>
          <p className="mt-1 text-sm font-semibold opacity-90">{data.program?.name ?? "—"}</p>
          <p className="mt-1 text-sm opacity-90">
            {t("merchant.stamps", { count: data.program?.stamps_required ?? 0, reward })}
          </p>
          <Link
            to="/merchant/program"
            className="touch-action mt-5 inline-flex items-center gap-2 rounded-md border border-current/25 bg-card/15 px-3 py-2 text-xs font-bold backdrop-blur-sm"
          >
            <Settings2 className="h-4 w-4" />
            {t("program.edit")}
          </Link>
        </div>

        <StoreJoinShare storeName={data.store.name} rewardName={reward} stampsRequired={data.program?.stamps_required ?? 10} />

        <div className="mt-5 space-y-3">
          {(
            [
              { to: "/merchant/customers", icon: Users, title: t("dash.customers"), hint: t("dash.customers.hint") },
              { to: "/merchant/team", icon: UserPlus, title: t("dash.team"), hint: t("dash.team.hint") },
              { to: "/merchant/store", icon: Store, title: t("dash.store"), hint: t("dash.store.hint") },
            ] as const
          ).map((tile) => (
            <Link
              key={tile.to}
              to={tile.to}
              className="touch-action animate-arrive flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden="true">
                <tile.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{tile.title}</span>
                <span className="block text-xs text-muted-foreground">{tile.hint}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
            </Link>
          ))}
        </div>

        <GrowthAnalytics />


        <Link to="/wallet" className="touch-action mt-6 flex items-center justify-between border-t border-border py-4 text-sm font-semibold text-primary">
          {t("merchant.switchToWallet")} <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
