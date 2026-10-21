import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { AppHeader } from "@/components/BrandMark";
import { CardPreviewMini } from "@/components/CardPreviewMini";
import { StampIconPicker } from "@/components/StampIconPicker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brandPalettes, cardThemes, resolveCardTheme, type CardTheme } from "@/lib/card-theme";
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

type Tab = "design" | "reward" | "growth";
const tabs: readonly Tab[] = ["design", "reward", "growth"];

type FormValues = {
  programName: string;
  stampsRequired: number;
  rewardName: string;
  rewardDescription: string;
  stampIcon: string;
  cardTheme: CardTheme;
  brandPrimary: string | null;
  brandAccent: string | null;
  backgroundTint: string | null;
};

const snapshot = (values: FormValues) => JSON.stringify(values);
const clampStamps = (text: string, fallback: number) => Math.min(50, Math.max(1, Math.round(Number(text) || fallback)));

function ProgramEditor() {
  const { state } = useFellogramAuth();
  const queryClient = useQueryClient();
  const loadStore = useServerFn(getMyStore);
  const save = useServerFn(updateProgram);

  const { data, isLoading } = useQuery({
    queryKey: ["my-store"],
    queryFn: () => loadStore(),
    enabled: state === "ready",
  });

  const [tab, setTab] = useState<Tab>("design");
  const [previewOpen, setPreviewOpen] = useState(true);
  const [programName, setProgramName] = useState("");
  const [stampsRequired, setStampsRequired] = useState(10);
  const [stampsText, setStampsText] = useState("10");
  const [rewardName, setRewardName] = useState("");
  const [rewardDescription, setRewardDescription] = useState("");
  const [stampIcon, setStampIcon] = useState("stamp");
  const [cardTheme, setCardTheme] = useState<CardTheme>("classic");
  const [brandPrimary, setBrandPrimary] = useState<string | null>(null);
  const [brandAccent, setBrandAccent] = useState<string | null>(null);
  const [backgroundTint, setBackgroundTint] = useState<string | null>(null);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const values: FormValues = {
    programName,
    stampsRequired: clampStamps(stampsText, stampsRequired),
    rewardName,
    rewardDescription,
    stampIcon,
    cardTheme,
    brandPrimary,
    brandAccent,
    backgroundTint,
  };
  const key = snapshot(values);
  const dirty = savedKey !== null && key !== savedKey;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const hydrated = useRef(false);
  const submittedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setPreviewLogo(data.logoUrl);
    // A background refresh (e.g. after a logo upload) must never wipe unsaved edits.
    if (hydrated.current && dirtyRef.current) return;
    const required = data.program?.stamps_required ?? 10;
    const reward = data.rewards.find((r) => r.kind === "standard") ?? data.rewards[0];
    const next: FormValues = {
      programName: data.program?.name ?? "Loyalty Card",
      stampsRequired: required,
      rewardName: reward?.name ?? "",
      rewardDescription: reward?.description ?? "",
      stampIcon: data.program?.stamp_icon ?? "stamp",
      cardTheme: resolveCardTheme(data.store.card_theme),
      brandPrimary: data.store.brand_primary,
      brandAccent: data.store.brand_accent,
      backgroundTint: data.store.background_tint,
    };
    setProgramName(next.programName);
    setStampsRequired(required);
    setStampsText(String(required));
    setRewardName(next.rewardName);
    setRewardDescription(next.rewardDescription);
    setStampIcon(next.stampIcon);
    setCardTheme(next.cardTheme);
    setBrandPrimary(next.brandPrimary);
    setBrandAccent(next.brandAccent);
    setBackgroundTint(next.backgroundTint);
    setSavedKey(snapshot(next));
    hydrated.current = true;
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          programName,
          stampsRequired: clampStamps(stampsText, stampsRequired),
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
      // Stay on this page: owners usually tweak several things in a row.
      setSavedKey(submittedKey.current);
      toast.success(t("program.saved"));
      await queryClient.invalidateQueries({ queryKey: ["my-store"] });
      await queryClient.invalidateQueries({ queryKey: ["my-cards"] });
    },
    onError: (error: Error) =>
      toast.error(error.message.includes("STAMP_ICON_MIGRATION_REQUIRED") ? t("program.iconMigration") : t("common.error")),
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

  const brandColors = { brandPrimary, brandAccent, backgroundTint };
  const hasCustomColors = Boolean(brandPrimary || brandAccent || backgroundTint);

  const changeStamps = (delta: number) => {
    setStampsRequired((value) => {
      const next = Math.min(50, Math.max(1, value + delta));
      setStampsText(String(next));
      return next;
    });
  };

  return (
    <main className={`min-h-screen ${dirty ? "pb-32" : "pb-14"}`}>
      <AppHeader subtitle={data.store.name} />

      <section className="app-shell">
        <h1 className="text-xl font-bold">{t("program.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("program.subtitle")}</p>

        {tab !== "growth" && (
          <div className="sticky top-0 z-20 -mx-5 mt-4 bg-background/90 px-5 pb-3 pt-2 backdrop-blur">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-xs font-semibold text-muted-foreground">{t("program.livePreview")}</span>
              <button type="button" onClick={() => setPreviewOpen((open) => !open)} className="touch-action px-1 py-1 text-xs font-semibold text-primary">
                {previewOpen ? t("program.previewHide") : t("program.previewShow")}
              </button>
            </div>
            {previewOpen && (
              <CardPreviewMini
                storeName={data.store.name}
                programName={programName}
                logoUrl={previewLogo}
                stampIcon={stampIcon}
                cardTheme={cardTheme}
                colors={brandColors}
                stampsRequired={values.stampsRequired}
                rewardName={rewardName}
              />
            )}
          </div>
        )}

        <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)} className="mt-3">
          <TabsList className="grid h-auto w-full grid-cols-3 p-1">
            {tabs.map((id) => (
              <TabsTrigger key={id} value={id} className="touch-action py-2.5 text-xs font-semibold sm:text-sm">
                {t(`program.tab.${id}` as TranslationKey)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="design" className="mt-5">
            <StoreLogoSettings logoUrl={data.logoUrl} onPreviewChange={setPreviewLogo} />
          </TabsContent>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (rewardName.trim().length < 2) {
                setTab("reward");
                toast.error(t("common.error"));
                return;
              }
              submittedKey.current = key;
              mutation.mutate();
            }}
          >
            <TabsContent value="design" className="mt-5 space-y-6">
              <div className="settings-section">
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

              <fieldset className="settings-section">
                <legend className="text-sm font-semibold">{t("program.stampIcon")}</legend>
                <StampIconPicker value={stampIcon} onChange={setStampIcon} logoUrl={previewLogo} />
              </fieldset>

              <fieldset className="settings-section">
                <legend className="text-sm font-semibold">{t("program.cardTheme")}</legend>
                <div className="mt-3 flex flex-wrap gap-3">
                  {cardThemes.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      aria-pressed={cardTheme === theme}
                      aria-label={t(`cardTheme.${theme}` as TranslationKey)}
                      title={t(`cardTheme.${theme}` as TranslationKey)}
                      onClick={() => {
                        setCardTheme(theme);
                        setBrandPrimary(null);
                        setBrandAccent(null);
                        setBackgroundTint(null);
                      }}
                      className={`touch-action relative h-11 w-11 rounded-full border border-border ring-offset-2 ring-offset-background ${cardTheme === theme ? "ring-2 ring-ring" : ""}`}
                    >
                      <span data-card-theme={theme} className="card-theme-swatch absolute inset-0.5 rounded-full" aria-hidden="true" />
                      {cardTheme === theme && <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t(`cardTheme.${cardTheme}` as TranslationKey)}</p>
              </fieldset>

              <details className="settings-section group" open={hasCustomColors}>
                <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-semibold">
                  {t("program.customColors")}
                  {hasCustomColors && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
                </summary>
                <div className="mt-2 space-y-2">
                  {([
                    ["brandPrimary", brandPrimary, setBrandPrimary, brandPalettes[cardTheme].primary],
                    ["brandAccent", brandAccent, setBrandAccent, brandPalettes[cardTheme].accent],
                    ["backgroundTint", backgroundTint, setBackgroundTint, brandPalettes[cardTheme].tint],
                  ] as const).map(([fieldKey, value, setter, fallback]) => (
                    <label key={fieldKey} className="color-field text-sm font-semibold">
                      <span className="min-w-0">
                        <span className="block">{t(`program.${fieldKey}`)}</span>
                      </span>
                      <input type="color" aria-label={t(`program.${fieldKey}`)} value={value ?? fallback} onChange={(event) => setter(event.target.value)} className="cursor-pointer" />
                    </label>
                  ))}
                  {hasCustomColors && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="touch-action font-semibold text-primary"
                      onClick={() => {
                        setBrandPrimary(null);
                        setBrandAccent(null);
                        setBackgroundTint(null);
                      }}
                    >
                      {t("program.resetColors")}
                    </Button>
                  )}
                </div>
              </details>
            </TabsContent>

            <TabsContent value="reward" className="mt-5 space-y-6">
              <div>
                <span className="text-sm font-semibold">{t("program.stamps")}</span>
                <div className="mt-1 flex items-center gap-3">
                  <Button type="button" aria-label="decrease stamps" onClick={() => changeStamps(-1)} variant="secondary" size="icon" className="touch-action h-11 w-11 shrink-0">
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
                      const parsed = clampStamps(stampsText, 10);
                      setStampsRequired(parsed);
                      setStampsText(String(parsed));
                    }}
                    className="w-20 rounded-md border border-border bg-card px-4 py-3 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button type="button" aria-label="increase stamps" onClick={() => changeStamps(1)} variant="secondary" size="icon" className="touch-action h-11 w-11 shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="settings-section">
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

              <div className="settings-section">
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
            </TabsContent>

            {dirty && (
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]">
                <div className="app-shell flex items-center gap-3 py-3">
                  <p className="min-w-0 flex-1 text-sm font-semibold text-muted-foreground">{t("program.unsaved")}</p>
                  <Button type="submit" disabled={mutation.isPending} className="touch-action h-12 px-6 font-bold">
                    {mutation.isPending ? t("program.saving") : t("program.save")}
                  </Button>
                </div>
              </div>
            )}
          </form>

          <TabsContent value="reward">
            <RewardsManager rewards={data.rewards} />
          </TabsContent>
          <TabsContent value="growth" className="mt-1">
            <ReferralSettings program={data.program} />
          </TabsContent>
        </Tabs>

        <Link to="/merchant" className="mt-6 block text-center text-sm font-semibold text-primary">
          {t("merchant.title")}
        </Link>
      </section>
    </main>
  );
}
