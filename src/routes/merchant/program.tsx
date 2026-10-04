import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { AppHeader } from "@/components/BrandMark";
import { StampIcon, stampIconOptions, type StampIconName } from "@/components/StampIcon";
import { StampCard } from "@/components/StampCard";
import { brandPalettes, brandThemeStyle, cardThemes, resolveCardTheme, type CardTheme } from "@/lib/card-theme";
import { StoreLogoSettings } from "@/components/StoreLogoSettings";
import { ReferralSettings } from "@/components/ReferralSettings";
import { RewardsManager } from "@/components/RewardsManager";
import { SplashScreen } from "@/components/SplashScreen";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t, type TranslationKey } from "@/lib/i18n";
import { getMyStore, updateProgram } from "@/lib/store.functions";

export const Route = createFileRoute("/merchant/program")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Loyalty program — Fellogram" },
      { name: "description", content: "Choose how many stamps a visit reward takes and what customers win." },
      { property: "og:title", content: "Loyalty program — Fellogram" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const [stampsText, setStampsText] = useState("10");
  const [rewardName, setRewardName] = useState("");
  const [rewardDescription, setRewardDescription] = useState("");
  const [stampIcon, setStampIcon] = useState<StampIconName>("stamp");
  const [cardTheme, setCardTheme] = useState<CardTheme>("classic");
  const [brandPrimary, setBrandPrimary] = useState<string | null>(null);
  const [brandAccent, setBrandAccent] = useState<string | null>(null);
  const [backgroundTint, setBackgroundTint] = useState<string | null>(null);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setProgramName(data.program?.name ?? "Loyalty Card");
    const required = data.program?.stamps_required ?? 10;
    setStampsRequired(required);
    setStampsText(String(required));
    const reward = data.rewards.find((r) => r.kind === "standard") ?? data.rewards[0];
    setRewardName(reward?.name ?? "");
    setRewardDescription(reward?.description ?? "");
    setStampIcon((data.program?.stamp_icon as StampIconName) ?? "stamp");
    setCardTheme(resolveCardTheme(data.store.card_theme));
    setBrandPrimary(data.store.brand_primary);
    setBrandAccent(data.store.brand_accent);
    setBackgroundTint(data.store.background_tint);
    setPreviewLogo(data.logoUrl);
  }, [data]);


  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          programName,
          stampsRequired: Math.min(50, Math.max(1, Math.round(Number(stampsText) || stampsRequired))),
          rewardName,
          rewardDescription,
          stampIcon,
          cardTheme,
          brandPrimary,
          brandAccent,
          backgroundTint,
        },
      }),
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
        <section className="app-shell rounded-lg bg-card p-8 text-center shadow-[var(--shadow-card)]">
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

        <div className="mt-4">
          <StoreLogoSettings logoUrl={data.logoUrl} onPreviewChange={setPreviewLogo} />
        </div>

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
              className="mt-1 w-full rounded-md border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">{t("program.stampIcon")}</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {stampIconOptions.map((icon) => (
                <Button key={icon} type="button" variant={stampIcon === icon ? "default" : "outline"} className="touch-action h-16 flex-col gap-1" onClick={() => setStampIcon(icon)} aria-pressed={stampIcon === icon}>
                  <StampIcon name={icon} className="h-5 w-5" />
                  <span className="text-xs">{t(`stampIcon.${icon}` as TranslationKey)}</span>
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">{t("program.cardTheme")}</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {cardThemes.map((theme) => (
                <Button key={theme} type="button" variant="outline" aria-pressed={cardTheme === theme} onClick={() => { setCardTheme(theme); setBrandPrimary(null); setBrandAccent(null); setBackgroundTint(null); }} className={`touch-action h-auto min-h-14 justify-start whitespace-normal border-2 px-2.5 py-2 text-start text-xs ${cardTheme === theme ? "border-ring" : ""}`}>
                  <span data-card-theme={theme} className="card-theme-swatch h-7 w-7 shrink-0 rounded-full border border-current/20" aria-hidden="true" />
                  <span>{t(`cardTheme.${theme}` as TranslationKey)}</span>
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">{t("program.brandColors")}</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {([
                ["brandPrimary", brandPrimary, setBrandPrimary, brandPalettes[cardTheme].primary],
                ["brandAccent", brandAccent, setBrandAccent, brandPalettes[cardTheme].accent],
                ["backgroundTint", backgroundTint, setBackgroundTint, brandPalettes[cardTheme].tint],
              ] as const).map(([key, value, setter, fallback]) => (
                <label key={key} className="flex min-w-0 flex-col gap-2 text-xs font-semibold">
                  <span>{t(`program.${key}`)}</span>
                  <input type="color" aria-label={t(`program.${key}`)} value={value ?? fallback} onChange={(event) => setter(event.target.value)} className="h-11 w-full cursor-pointer rounded-md border border-border bg-card p-1" />
                  <span className="font-mono text-[11px] text-muted-foreground">{value ?? fallback}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <span className="text-sm font-semibold">{t("program.stamps")}</span>
            <div className="mt-1 flex items-center gap-3">
              <Button
                type="button"
                aria-label="decrease stamps"
                onClick={() => {
                  setStampsRequired((value) => {
                    const next = Math.max(1, value - 1);
                    setStampsText(String(next));
                    return next;
                  });
                }}
                variant="secondary" size="icon" className="touch-action h-11 w-11 shrink-0"
              >
                <Minus className="h-4 w-4" />
              </Button>
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
                  setStampsText(String(parsed));
                }}
                className="w-20 rounded-md border border-border bg-card px-4 py-3 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
              />

              <Button
                type="button"
                aria-label="increase stamps"
                onClick={() => {
                  setStampsRequired((value) => {
                    const next = Math.min(50, value + 1);
                    setStampsText(String(next));
                    return next;
                  });
                }}
                variant="secondary" size="icon" className="touch-action h-11 w-11 shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
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
              className="mt-1 w-full rounded-md border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
              className="mt-1 w-full rounded-md border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold">{t("program.livePreview")}</h2>
            <div className="store-theme rounded-md border border-border p-3" style={brandThemeStyle(cardTheme, { brandPrimary, brandAccent, backgroundTint })}>
              <div className="mb-3 flex items-center justify-between border-b border-border pb-2 text-sm font-bold"><span>{data.store.name}</span><span className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground">{t("join.action")}</span></div>
            <ul>
              <StampCard preview card={{
                id: "preview", storeName: data.store.name, programName: programName || "Loyalty Card",
                stampsRequired: Math.min(50, Math.max(1, Math.round(Number(stampsText) || stampsRequired))),
                stampBalance: Math.min(3, Math.min(50, Math.max(1, Math.round(Number(stampsText) || stampsRequired)))),
                reward: rewardName || null, lastVisitAt: null, logoUrl: previewLogo,
                stampIcon, cardTheme, brandPrimary, brandAccent, backgroundTint, visits: [],
                rewards: rewardName ? [{ id: "preview-reward", name: rewardName, description: rewardDescription || null, stampsRequired: Math.min(50, Math.max(1, Math.round(Number(stampsText) || stampsRequired))) }] : [],
              }} />
            </ul>
            </div>
          </div>

          <Button
            type="submit"
            disabled={mutation.isPending}
            className="touch-action h-14 w-full font-bold"
          >
            {mutation.isPending ? t("program.saving") : t("program.save")}
          </Button>
        </form>

        <RewardsManager rewards={data.rewards} />
        <ReferralSettings program={data.program} />

        <Link to="/merchant" className="mt-6 block text-center text-sm font-semibold text-primary">
          {t("merchant.title")}
        </Link>
      </section>
    </main>
  );
}
