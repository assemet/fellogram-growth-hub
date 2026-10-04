import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Stamp, TrendingUp, Users } from "lucide-react";

import { AppHeader } from "@/components/BrandMark";
import { SplashScreen } from "@/components/SplashScreen";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { getMyStore } from "@/lib/store.functions";
import { GrowthAnalytics } from "@/components/GrowthAnalytics";

export const Route = createFileRoute("/merchant/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Store dashboard — Fellogram" },
      { name: "description", content: "See customers, visits, rewards and referral growth for your store." },
      { property: "og:title", content: "Store dashboard — Fellogram" },
      { property: "og:description", content: "Is loyalty growing your business? Find out in one screen." },
    ],
  }),
  component: MerchantDashboard,
});

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-[var(--shadow-card)]">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        {icon}
      </span>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function MerchantDashboard() {
  const { state } = useFellogramAuth();
  const loadStore = useServerFn(getMyStore);
  const { data, isLoading } = useQuery({
    queryKey: ["my-store"],
    queryFn: () => loadStore(),
    enabled: state === "ready",
  });

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
      <AppHeader subtitle={data.store.name} />

      <section className="app-shell">
        <h1 className="mb-3 text-xl font-bold">{t("merchant.title")}</h1>

        <div className="brand-surface rounded-3xl p-5 shadow-[var(--shadow-float)]">
          <p className="text-xs opacity-80">{t("merchant.program")}</p>
          <p className="font-display text-lg font-bold">{data.program?.name ?? "—"}</p>
          <p className="mt-1 text-sm opacity-90">
            {t("merchant.stamps", { count: data.program?.stamps_required ?? 0, reward })}
          </p>
          <Link
            to="/merchant/program"
            className="mt-3 inline-block rounded-full bg-white/20 px-4 py-2 text-xs font-semibold"
          >
            {t("program.edit")}
          </Link>
        </div>

        <GrowthAnalytics />


        <Link to="/wallet" className="mt-6 block text-center text-sm font-semibold text-primary">
          {t("merchant.switchToWallet")}
        </Link>
      </section>
    </main>
  );
}
