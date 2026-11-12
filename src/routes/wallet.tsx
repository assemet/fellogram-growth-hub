import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { brandThemeStyle } from "@/lib/card-theme";

import { AppHeader } from "@/components/BrandMark";
import { BottomNav } from "@/components/BottomNav";
import { SplashScreen } from "@/components/SplashScreen";
import { MyQrDialog } from "@/components/MyQrDialog";
import { NotificationsCard } from "@/components/NotificationsCard";
import { StartStoreCard } from "@/components/StartStoreCard";
import { StoreContactLinks } from "@/components/StoreContactLinks";
import { RemoveCardSection } from "@/components/RemoveCardSection";
import { QueryError } from "@/components/QueryError";
import { StoreScanButton } from "@/components/StoreScanButton";
import { WalletEmptyState } from "@/components/WalletEmptyState";
import { StampCard } from "@/components/StampCard";
import { WalletCardRow, WalletCardTile, WalletViewToggle } from "@/components/WalletCardViews";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { readWalletView, writeWalletView } from "@/lib/prefs";
import { getMyCards, getMyContext } from "@/lib/store.functions";
import { autoWalletView, sortWalletCards, type WalletView } from "@/lib/wallet-view";

export const Route = createFileRoute("/wallet")({
  ssr: false,
  validateSearch: z.object({ store: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "My Loyalty — Fellogram" },
      { name: "description", content: "Your loyalty cards, stamp progress and rewards in one place." },
      { property: "og:title", content: "My Loyalty — Fellogram" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Track stamps and rewards from your favourite local stores." },
    ],
  }),
  component: Wallet,
});

function Wallet() {
  const { store: focusedStoreId } = Route.useSearch();
  const { state } = useFellogramAuth();
  const loadContext = useServerFn(getMyContext);
  const loadCards = useServerFn(getMyCards);
  const [chosenView, setChosenView] = useState<WalletView | null>(() => readWalletView());

  const { data } = useQuery({
    queryKey: ["my-context"],
    queryFn: () => loadContext(),
    enabled: state === "ready",
  });
  const { data: cards, error: cardsError, refetch } = useQuery({
    queryKey: ["my-cards"],
    queryFn: () => loadCards(),
    enabled: state === "ready",
    retry: 1,
  });

  if (cardsError) return <QueryError error={cardsError} onRetry={() => refetch()} />;

  if (state !== "ready" || !data || !cards) return <SplashScreen />;

  const firstName = data.profile?.first_name ?? "";
  const focusedCard = cards.find((card) => card.storeId === focusedStoreId);
  // Until the person picks a layout, a few cards show in full and more show as a compact list.
  const view: WalletView = focusedCard ? "full" : chosenView ?? autoWalletView(cards.length);
  const shown = focusedCard ? [focusedCard] : sortWalletCards(cards);
  const chooseView = (next: WalletView) => {
    writeWalletView(next);
    setChosenView(next);
  };

  return (
    <main className={`${focusedCard ? "store-theme " : ""}min-h-[100dvh] pb-[calc(3.5rem+env(safe-area-inset-bottom))]`} style={focusedCard ? brandThemeStyle(focusedCard.cardTheme, focusedCard) : undefined}>
      <AppHeader subtitle={focusedCard ? focusedCard.storeName : firstName ? t("wallet.greeting", { name: firstName }) : t("app.tagline")} />

      <section className="app-shell">
        {focusedCard && <Link to="/wallet" search={{ store: undefined }} className="mb-4 inline-flex text-sm font-semibold text-primary">← {t("wallet.allCards")}</Link>}
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate text-2xl font-bold">{focusedCard ? focusedCard.storeName : t("wallet.title")}</h1>
          {cards.length > 0 && data.profile?.id && <MyQrDialog customerId={data.profile.id} />}
        </div>

        {!focusedCard && cards.length >= 1 && (
          <div className="mb-4 flex justify-end">
            <WalletViewToggle view={view} onChange={chooseView} />
          </div>
        )}

        {cards.length === 0 ? (
          <WalletEmptyState />
        ) : view === "list" ? (
          <ul className="space-y-3">
            {shown.map((card) => (
              <WalletCardRow key={card.id} card={card} />
            ))}
          </ul>
        ) : view === "grid" ? (
          <ul className="grid grid-cols-2 gap-3">
            {shown.map((card) => (
              <WalletCardTile key={card.id} card={card} />
            ))}
          </ul>
        ) : (
          <ul className="wallet-card-list space-y-7">
            {shown.map((card) => (
              <StampCard key={card.id} card={card} focused={Boolean(focusedCard)} />
            ))}
          </ul>
        )}
{focusedCard && <StoreContactLinks contact={focusedCard.contact} className="mt-5" />}
{focusedCard && <RemoveCardSection storeId={focusedCard.storeId} storeName={focusedCard.storeName} balance={focusedCard.stampBalance} />}

{cards.length > 0 && (
          <div className="mt-6">
            <NotificationsCard />
          </div>
        )}

{!focusedCard && cards.length > 0 && <StoreScanButton variant="outline" label={t("wallet.addCard")} className="mt-6 w-full" />}

{!focusedCard && !data.ownedStoreId && <StartStoreCard className="mt-6" />}

              </section>
      <BottomNav current="wallet" />
    </main>
  );
}
