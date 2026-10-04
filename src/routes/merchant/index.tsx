import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppHeader } from "@/components/BrandMark";
import { SplashScreen } from "@/components/SplashScreen";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { getMyStore } from "@/lib/store.functions";
import { GrowthAnalytics } from "@/components/GrowthAnalytics";
import { ArrowRight, Settings2 } from "lucide-react";

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
        <h1 className="mb-4 text-2xl font-bold">{t("merchant.title")}</h1>

        <div className="brand-surface animate-arrive rounded-lg p-5 shadow-[var(--shadow-float)]">
          <p className="text-xs font-bold uppercase opacity-80">{t("merchant.program")}</p>
          <p className="mt-2 font-display text-2xl font-bold leading-tight">{data.program?.name ?? "—"}</p>
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

        <GrowthAnalytics />


        <Link to="/wallet" className="touch-action mt-6 flex items-center justify-between border-t border-border py-4 text-sm font-semibold text-primary">
          {t("merchant.switchToWallet")} <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
