import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ScanLine } from "lucide-react";

import { AppHeader } from "@/components/BrandMark";
import { SplashScreen } from "@/components/SplashScreen";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { getMyContext } from "@/lib/store.functions";

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

function Cashier() {
  const { state } = useFellogramAuth();
  const loadContext = useServerFn(getMyContext);
  const { data } = useQuery({
    queryKey: ["my-context"],
    queryFn: () => loadContext(),
    enabled: state === "ready",
  });

  if (state !== "ready" || !data) return <SplashScreen />;

  // Strict role isolation: cashier mode is only for store staff/owners.
  const allowed = Boolean(data.staffStoreId || data.ownedStoreId);
  if (!allowed) {
    return (
      <main className="min-h-screen">
        <AppHeader />
        <section className="app-shell rounded-3xl bg-card p-6 text-center shadow-[var(--shadow-card)]">
          <p className="font-semibold">{t("cashier.title")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("common.error")}</p>
          <Link to="/wallet" className="mt-4 inline-block text-sm font-semibold text-primary">
            {t("merchant.switchToWallet")}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <AppHeader subtitle={t("cashier.title")} />
      <section className="app-shell rounded-3xl bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <ScanLine className="mx-auto mb-3 h-8 w-8 text-primary" />
        <p className="font-semibold">{t("cashier.title")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("cashier.soon")}</p>
      </section>
    </main>
  );
}
