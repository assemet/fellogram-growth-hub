import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState } from "react";
import { Search } from "lucide-react";
import { z } from "zod";
import { brandThemeStyle } from "@/lib/card-theme";

import { CardCelebration, useCardCelebration } from "@/components/CardCelebration";
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
import { normalizeForSearch } from "@/lib/people";
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
  const [query, setQuery] = useState("");

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

  const celebration = useCardCelebration(cards);

  if (cardsError) return <QueryError error={cardsError} onRetry={() => refetch()} />;

  if (state !== "ready" || !data || !cards) return <SplashScreen />;

  const firstName = data.profile?.first_name ?? "";
  const focusedCard = cards.find((card) => card.storeId === focusedStoreId);
  // Until the person picks a layout, a few cards show in full and more show as a compact list.
  const view: WalletView = focusedCard ? "full" : chosenView ?? autoWalletView(cards.length);
  // With a few cards, finding one by store name is faster than scrolling.
  const searchable = !focusedCard && cards.length >= 3;
  const needle = searchable ? normalizeForSearch(query) : "";
  const sorted = sortWalletCards(cards);
  const shown = focusedCard ? [focusedCard] : needle ? sorted.filter((card) => normalizeForSearch(card.storeName).includes(needle)) : sorted;
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
        </div>
        {cards.length > 0 && data.profile?.id && (
          <div className="mb-4">
            <MyQrDialog customerId={data.profile.id} />
          </div>
        )}

        {!focusedCard && cards.length >= 1 && (
          <div className="mb-4 flex items-center justify-between gap-3">
            {searchable ? (
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("wallet.search.placeholder")}
                  aria-label={t("wallet.search.placeholder")}
                  enterKeyHint="search"
                  className="h-11 w-full rounded-md border border-border bg-card ps-9 pe-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            ) : (
              <span />
            )}
            <WalletViewToggle view={view} onChange={chooseView} />
          </div>
        )}

        {cards.length === 0 ? (
          <WalletEmptyState />
        ) : shown.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{t("wallet.search.empty", { q: query.trim() })}</p>
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
              <Fragment key={card.id}>
                {/* With several cards, a store-name divider shows where one card (and its offers) ends and the next begins. */}
                {shown.length > 1 && (
                  <li className="wallet-card-divider" aria-hidden="true">
                    <span className="min-w-0 truncate">{card.storeName}</span>
                  </li>
                )}
                <StampCard card={card} focused={Boolean(focusedCard)} />
              </Fragment>
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
      {celebration.card && <CardCelebration card={celebration.card} onClose={celebration.dismiss} />}
    </main>
  );
}
