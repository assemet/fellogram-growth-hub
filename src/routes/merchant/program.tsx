import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/BrandMark";
import { SplashScreen } from "@/components/SplashScreen";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { getMyStore, updateProgram } from "@/lib/store.functions";

export const Route = createFileRoute("/merchant/program")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Loyalty program — Fellogram" },
      { name: "description", content: "Choose how many stamps a visit reward takes and what customers win." },
      { property: "og:title", content: "Loyalty program — Fellogram" },
      { property: "og:description", content: "Design the stamp card your customers collect." },
    ],
  }),
  component: ProgramEditor,
});

function ProgramEditor() {
  const { state } = useFellogramAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loadStore = useServerFn(getMyStore);
  const save = useServerFn(updateProgram);

  const { data, isLoading } = useQuery({
    queryKey: ["my-store"],
    queryFn: () => loadStore(),
    enabled: state === "ready",
  });

  const [programName, setProgramName] = useState("");
  const [stampsRequired, setStampsRequired] = useState(10);
  const [rewardName, setRewardName] = useState("");
  const [rewardDescription, setRewardDescription] = useState("");

  useEffect(() => {
    if (!data) return;
    setProgramName(data.program?.name ?? "Loyalty Card");
    setStampsRequired(data.program?.stamps_required ?? 10);
    const reward = data.rewards.find((r) => r.kind === "standard") ?? data.rewards[0];
    setRewardName(reward?.name ?? "");
    setRewardDescription(reward?.description ?? "");
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      save({ data: { programName, stampsRequired, rewardName, rewardDescription } }),
    onSuccess: async () => {
      toast.success(t("program.saved"));
      await queryClient.invalidateQueries({ queryKey: ["my-store"] });
      await queryClient.invalidateQueries({ queryKey: ["my-cards"] });
      navigate({ to: "/merchant" });
    },
    onError: () => toast.error(t("common.error")),
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

  return (
    <main className="min-h-screen pb-14">
      <AppHeader subtitle={data.store.name} />

      <section className="app-shell">
        <h1 className="text-xl font-bold">{t("program.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("program.subtitle")}</p>

        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (rewardName.trim().length < 2) {
              toast.error(t("common.error"));
              return;
            }
            mutation.mutate();
          }}
        >
          <div>
            <label htmlFor="programName" className="text-sm font-semibold">
              {t("program.name")}
            </label>
            <input
              id="programName"
              value={programName}
              onChange={(event) => setProgramName(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <span className="text-sm font-semibold">{t("program.stamps")}</span>
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                aria-label="decrease stamps"
                onClick={() => setStampsRequired((value) => Math.max(1, value - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                id="stampsRequired"
                type="number"
                min={1}
                max={50}
                value={stampsText}
                onChange={(event) => setStampsText(event.target.value)}
                onBlur={() => {
                  const parsed = Math.min(50, Math.max(1, Math.round(Number(stampsText) || 10)));
                  setStampsRequired(parsed);
                }}
                className="w-20 rounded-2xl border border-border bg-card px-4 py-3 text-center text-sm outline-none focus:border-primary"
              />

              <button
                type="button"
                aria-label="increase stamps"
                onClick={() => setStampsRequired((value) => Math.min(50, value + 1))}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="rewardName" className="text-sm font-semibold">
              {t("program.reward")}
            </label>
            <input
              id="rewardName"
              value={rewardName}
              onChange={(event) => setRewardName(event.target.value)}
              placeholder="Free coffee"
              className="mt-1 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="rewardDescription" className="text-sm font-semibold">
              {t("program.rewardDescription")}
            </label>
            <textarea
              id="rewardDescription"
              value={rewardDescription}
              onChange={(event) => setRewardDescription(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="brand-surface rounded-3xl p-4">
            <p className="text-xs opacity-80">{t("merchant.program")}</p>
            <p className="font-display text-lg font-bold">
              {t("program.preview", { count: stampsRequired, reward: rewardName || "—" })}
            </p>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-full bg-primary px-6 py-4 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {mutation.isPending ? t("program.saving") : t("program.save")}
          </button>
        </form>

        <Link to="/merchant" className="mt-6 block text-center text-sm font-semibold text-primary">
          {t("merchant.title")}
        </Link>
      </section>
    </main>
  );
}
