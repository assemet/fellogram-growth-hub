import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LayoutDashboard, MoreHorizontal, ScanLine, Sparkles } from "lucide-react";
import { z } from "zod";
import { brandThemeStyle } from "@/lib/card-theme";

import { AppHeader } from "@/components/BrandMark";
import { SplashScreen } from "@/components/SplashScreen";
import { CustomerQr } from "@/components/CustomerQr";
import { StampCard } from "@/components/StampCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { getMyCards, getMyContext } from "@/lib/store.functions";

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
  const focusedCard = cards.find((card) => card.storeId === focusedStoreId);
  const headerAction = data.ownedStoreId ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="touch-action px-2 text-muted-foreground">
          <MoreHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">{t("merchant.options")}</span>
          <span className="sr-only sm:hidden">{t("merchant.options")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link to="/cashier">
            <ScanLine />
            {t("merchant.switchToCashier")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/merchant">
            <LayoutDashboard />
            {t("merchant.title")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : data.staffStoreId ? (
    <Button asChild variant="ghost" size="sm" className="touch-action px-2 text-muted-foreground">
      <Link to="/cashier">
        <ScanLine className="h-4 w-4" />
        <span className="hidden sm:inline">{t("merchant.switchToCashier")}</span>
        <span className="sr-only sm:hidden">{t("merchant.switchToCashier")}</span>
      </Link>
    </Button>
  ) : undefined;

  return (
    <main className={`${focusedCard ? "store-theme " : ""}min-h-[100dvh] pb-[calc(3.5rem+env(safe-area-inset-bottom))]`} style={focusedCard ? brandThemeStyle(focusedCard.cardTheme, focusedCard) : undefined}>
      <AppHeader subtitle={focusedCard ? focusedCard.storeName : firstName ? t("wallet.greeting", { name: firstName }) : t("app.tagline")} action={focusedCard ? undefined : headerAction} />

      <section className="app-shell">
        {focusedCard && <Link to="/wallet" search={{ store: undefined }} className="mb-4 inline-flex text-sm font-semibold text-primary">← {t("join.viewWallet")}</Link>}
        <h1 className="mb-4 text-2xl font-bold">{focusedCard ? focusedCard.storeName : t("wallet.title")}</h1>

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
          <ul className="wallet-card-list space-y-7">
            {(focusedCard ? [focusedCard] : cards).map((card) => (
              <StampCard key={card.id} card={card} focused={Boolean(focusedCard)} />
            ))}
          </ul>
        )}

      </section>
    </main>
  );
}
