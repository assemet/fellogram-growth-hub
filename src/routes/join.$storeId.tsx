import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StampIcon } from "@/components/StampIcon";

import { AppHeader } from "@/components/BrandMark";
import { SplashScreen } from "@/components/SplashScreen";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { getStoreForJoin, joinStore } from "@/lib/store.functions";

export const Route = createFileRoute("/join/$storeId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Join a loyalty card — Fellogram" },
      { name: "description", content: "Join a store's stamp card and start earning rewards on every visit." },
      { property: "og:title", content: "Join a loyalty card — Fellogram" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Collect stamps on every visit and unlock your reward." },
    ],
  }),
  component: JoinStore,
});

function JoinStore() {
  const { storeId } = Route.useParams();
  const { state } = useFellogramAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const loadStore = useServerFn(getStoreForJoin);
  const join = useServerFn(joinStore);

  const { data, isLoading } = useQuery({
    queryKey: ["join-store", storeId],
    queryFn: () => loadStore({ data: { storeId } }),
    enabled: state === "ready",
  });

  const mutation = useMutation({
    mutationFn: () => join({ data: { storeId } }),
    onSuccess: async () => {
      toast.success(t("join.success"));
      await queryClient.invalidateQueries({ queryKey: ["my-cards"] });
      navigate({ to: "/wallet", replace: true });
    },
    onError: () => toast.error(t("common.error")),
  });

  if (state !== "ready" || isLoading) return <SplashScreen />;

  if (!data) {
    return (
      <main className="min-h-screen">
        <AppHeader />
        <section className="app-shell rounded-lg bg-card p-8 text-center shadow-[var(--shadow-card)]">
          <p className="font-semibold">{t("join.notFound")}</p>
          <Link to="/wallet" className="mt-4 inline-block text-sm font-semibold text-primary">
            {t("join.viewWallet")}
          </Link>
        </section>
      </main>
    );
  }

  const required = data.program?.stamps_required ?? 10;

  return (
    <main className="min-h-[100dvh] pb-14">
      <AppHeader subtitle={data.store.name} />

      <section className="app-shell">
        <h1 className="text-2xl font-bold">{t("join.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("join.subtitle")}</p>

        <div className="animate-arrive mt-4 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            {data.logoUrl && <img src={data.logoUrl} alt="" className="h-14 w-14 rounded-lg border border-border object-cover" />}
            <p className="font-display text-lg font-bold">{data.store.name}</p>
          </div>
          {data.store.description && (
            <p className="mt-1 text-sm text-muted-foreground">{data.store.description}</p>
          )}

          <p className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <StampIcon name={data.program?.stamp_icon} className="h-4 w-4 text-primary" />
            {t("program.preview", { count: required, reward: data.reward?.name ?? "—" })}
          </p>
          {data.reward?.description && (
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Gift className="h-3.5 w-3.5" />
              {data.reward.description}
            </p>
          )}

          <div
            className="mt-5 grid grid-cols-5 gap-2"
          >
            {Array.from({ length: required }).map((_, index) => (
              <div
                key={index}
                className="flex aspect-square items-center justify-center rounded-full border-2 border-dashed border-border bg-secondary/40"
              >
                <StampIcon name={data.program?.stamp_icon} className="h-4 w-4 opacity-30" />
              </div>
            ))}
          </div>
        </div>

        {data.alreadyJoined ? (
          <div className="mt-5 text-center">
            <p className="text-sm text-muted-foreground">{t("join.already")}</p>
            <Link
              to="/wallet"
              className="mt-3 inline-block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
            >
              {t("join.viewWallet")}
            </Link>
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="touch-action mt-5 h-14 w-full font-bold"
          >
            {mutation.isPending ? t("join.joining") : t("join.action")}
          </Button>
        )}
      </section>
    </main>
  );
}
