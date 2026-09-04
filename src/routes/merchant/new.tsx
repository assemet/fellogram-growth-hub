import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/BrandMark";
import { SplashScreen } from "@/components/SplashScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { createStore } from "@/lib/store.functions";

export const Route = createFileRoute("/merchant/new")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create your store — Fellogram" },
      {
        name: "description",
        content: "Set up your store and stamp-based loyalty program in under a minute.",
      },
      { property: "og:title", content: "Create your store — Fellogram" },
      {
        property: "og:description",
        content: "Launch a Telegram loyalty program for your business.",
      },
    ],
  }),
  component: NewStore,
});

function NewStore() {
  const { state } = useFellogramAuth();
  const navigate = useNavigate();
  const submit = useServerFn(createStore);

  const [step, setStep] = useState(0);
  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [programName, setProgramName] = useState("");
  const [stampsRequired, setStampsRequired] = useState(10);
  const [rewardName, setRewardName] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: { storeName, description, programName, stampsRequired, rewardName },
      }),
    onSuccess: () => setStep(2),
    onError: () => toast.error(t("common.error")),
  });

  if (state !== "ready") return <SplashScreen />;

  return (
    <main className="min-h-screen pb-14">
      <AppHeader subtitle={t("onboarding.step", { current: step + 1, total: 3 })} />

      <section className="app-shell">
        {step === 0 && (
          <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
            <h1 className="text-xl font-bold">{t("onboarding.store.title")}</h1>
            <p className="mb-4 text-sm text-muted-foreground">{t("onboarding.store.subtitle")}</p>

            <Label htmlFor="storeName">{t("onboarding.store.name")}</Label>
            <Input
              id="storeName"
              value={storeName}
              onChange={(event) => setStoreName(event.target.value)}
              placeholder={t("onboarding.store.namePlaceholder")}
              className="mt-1 mb-4"
            />

            <Label htmlFor="storeDescription">{t("onboarding.store.description")}</Label>
            <Input
              id="storeDescription"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1"
            />

            <Button
              className="mt-6 w-full rounded-full"
              disabled={storeName.trim().length < 2}
              onClick={() => setStep(1)}
            >
              {t("onboarding.next")}
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
            <h1 className="text-xl font-bold">{t("onboarding.program.title")}</h1>
            <p className="mb-4 text-sm text-muted-foreground">{t("onboarding.program.subtitle")}</p>

            <Label htmlFor="programName">{t("onboarding.program.name")}</Label>
            <Input
              id="programName"
              value={programName}
              onChange={(event) => setProgramName(event.target.value)}
              placeholder={t("onboarding.program.namePlaceholder")}
              className="mt-1 mb-4"
            />

            <Label htmlFor="stamps">{t("onboarding.program.stamps")}</Label>
            <Input
              id="stamps"
              type="number"
              min={1}
              max={100}
              value={stampsRequired}
              onChange={(event) => setStampsRequired(Number(event.target.value))}
              className="mt-1 mb-4"
            />

            <Label htmlFor="rewardName">{t("onboarding.program.reward")}</Label>
            <Input
              id="rewardName"
              value={rewardName}
              onChange={(event) => setRewardName(event.target.value)}
              placeholder={t("onboarding.program.rewardPlaceholder")}
              className="mt-1"
            />

            <div className="mt-4 rounded-2xl bg-secondary p-3 text-center text-sm font-semibold text-secondary-foreground">
              {t("onboarding.preview", {
                count: stampsRequired,
                reward: rewardName || t("onboarding.program.rewardPlaceholder"),
              })}
            </div>

            <Button
              className="mt-5 w-full rounded-full"
              disabled={rewardName.trim().length < 2 || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? t("onboarding.creating") : t("onboarding.create")}
            </Button>
            <Button
              variant="ghost"
              className="mt-2 w-full rounded-full"
              onClick={() => setStep(0)}
              disabled={mutation.isPending}
            >
              {t("onboarding.back")}
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="brand-surface rounded-3xl p-8 text-center shadow-[var(--shadow-float)]">
            <img
              src="/logo.png"
              alt=""
              className="mx-auto mb-4 h-20 w-20 rounded-3xl bg-card object-contain p-2"
            />
            <h1 className="text-xl font-bold">{t("onboarding.done.title")}</h1>
            <p className="mt-2 text-sm opacity-90">{t("onboarding.done.body")}</p>
            <Button
              variant="secondary"
              className="mt-6 w-full rounded-full"
              onClick={() => navigate({ to: "/merchant", replace: true })}
            >
              {t("onboarding.goToDashboard")}
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
