import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ScanLine, Store, Sparkles } from "lucide-react";

import { AppHeader } from "@/components/BrandMark";
import { SplashScreen } from "@/components/SplashScreen";
import { CustomerQr } from "@/components/CustomerQr";
import { StampCard } from "@/components/StampCard";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { getMyCards, getMyContext } from "@/lib/store.functions";

export const Route = createFileRoute("/wallet")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Loyalty — Fellogram" },
      { name: "description", content: "Your loyalty cards, stamp progress and rewards in one place." },
      { property: "og:title", content: "My Loyalty — Fellogram" },
      { property: "og:description", content: "Track stamps and rewards from your favourite local stores." },
    ],
  }),
  component: Wallet,
});

function Wallet() {
  const { state } = useFellogramAuth();
  const loadContext = useServerFn(getMyContext);
  const loadCards = useServerFn(getMyCards);

  const { data } = useQuery({
    queryKey: ["my-context"],
    queryFn: () => loadContext(),
    enabled: state === "ready",
  });
  const { data: cards } = useQuery({
    queryKey: ["my-cards"],
    queryFn: () => loadCards(),
    enabled: state === "ready",
  });

  if (state !== "ready" || !data || !cards) return <SplashScreen />;

  const firstName = data.profile?.first_name ?? "";

  return (
    <main className="min-h-[100dvh] pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      <AppHeader subtitle={firstName ? `Hi ${firstName} 👋` : t("app.tagline")} />

      <section className="app-shell">
        <h1 className="mb-4 text-2xl font-bold">{t("wallet.title")}</h1>

        {data.profile?.id && (
          <div className="mb-4">
            <CustomerQr customerId={data.profile.id} />
          </div>
        )}

        {cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
            <Sparkles className="mx-auto mb-3 h-7 w-7 text-primary" />
            <p className="font-semibold">{t("wallet.empty.title")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("wallet.empty.body")}</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {cards.map((card) => (
              <StampCard key={card.id} card={card} />
            ))}
          </ul>
        )}

        {!data.ownedStoreId && (
          <Link
            to="/merchant/new"
            className="touch-action mt-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card px-4 py-4 text-left shadow-[var(--shadow-card)]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Store className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-muted-foreground">{t("wallet.merchantCta.title")}</span>
              <span className="block font-semibold text-secondary-foreground">
                {t("wallet.merchantCta.action")}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        )}

        {(data.staffStoreId || data.ownedStoreId) && (
          <Link
            to="/cashier"
            className="touch-action mt-6 flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-4 text-center font-bold text-primary-foreground"
          >
            <ScanLine className="h-5 w-5" />
            {t("cashier.title")}
          </Link>
        )}

        {data.ownedStoreId && (
          <Link
            to="/merchant"
            className="touch-action mt-3 flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-4 text-center font-semibold text-foreground"
          >
            {t("merchant.title")}
          </Link>
        )}
      </section>
    </main>
  );
}
