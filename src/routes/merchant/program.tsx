import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Gift, Minus, Palette, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

import { AppHeader } from "@/components/BrandMark";
import { BackLink } from "@/components/BackLink";
import { SettingsCard } from "@/components/SettingsCard";
import { CardPreviewMini } from "@/components/CardPreviewMini";
import { StampIconPicker } from "@/components/StampIconPicker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brandPalettes, cardThemes, resolveCardTheme, type CardTheme } from "@/lib/card-theme";
import { StoreLogoSettings } from "@/components/StoreLogoSettings";
import { ReferralSettings } from "@/components/ReferralSettings";
import { RewardsManager } from "@/components/RewardsManager";
import { QueryError } from "@/components/QueryError";
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
const TAB_ICONS = { design: Palette, reward: Gift, growth: Users } as const;
const INPUT = "w-full rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring";

type FormValues = {
  programName: string;
  stampsRequired: number;
  rewardName: string;
  rewardDescription: string;
  stampIcon: string;
  stampCooldownMinutes: number;
  joinBonusStamps: number;
  cardTheme: CardTheme;
  brandPrimary: string | null;
  brandAccent: string | null;
  backgroundTint: string | null;
};

const snapshot = (values: FormValues) => JSON.stringify(values);
/** Welcome stamps are limited to one less than the stamps needed, so joining alone never earns the reward. */
const clampJoinBonus = (on: boolean, text: string, required: number) =>
  on ? Math.max(0, Math.min(20, Math.max(0, required - 1), Math.round(Number(text)) || 0)) : 0;
const clampCooldown = (text: string) => Math.min(1440, Math.max(0, Math.round(Number(text)) || 0));
const clampStamps = (text: string, fallback: number) => Math.min(50, Math.max(1, Math.round(Number(text) || fallback)));

function ProgramEditor() {
  const { state } = useFellogramAuth();
  const queryClient = useQueryClient();
  const loadStore = useServerFn(getMyStore);
  const save = useServerFn(updateProgram);

  const { data, isLoading, error, refetch } = useQuery({
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
  const [cooldownText, setCooldownText] = useState("15");
  const [joinBonusOn, setJoinBonusOn] = useState(false);
  const [joinBonusText, setJoinBonusText] = useState("1");
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
    stampCooldownMinutes: clampCooldown(cooldownText),
    joinBonusStamps: clampJoinBonus(joinBonusOn, joinBonusText, clampStamps(stampsText, stampsRequired)),
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
      stampCooldownMinutes: data.program?.stamp_cooldown_minutes ?? 15,
      joinBonusStamps: data.program?.join_bonus_stamps ?? 0,
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
    setCooldownText(String(next.stampCooldownMinutes));
    setJoinBonusOn(next.joinBonusStamps > 0);
    setJoinBonusText(String(next.joinBonusStamps > 0 ? next.joinBonusStamps : 1));
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
          stampCooldownMinutes: clampCooldown(cooldownText),
          joinBonusStamps: clampJoinBonus(joinBonusOn, joinBonusText, clampStamps(stampsText, stampsRequired)),
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
      toast.error(
        error.message.includes("STAMP_ICON_MIGRATION_REQUIRED")
          ? t("program.iconMigration")
          : error.message.includes("DB_MIGRATION_REQUIRED")
            ? t("error.migrationNeeded")
            : t("common.error"),
      ),
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
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
        <BackLink to="/merchant">{t("merchant.title")}</BackLink>
        <h1 className="mt-3 text-xl font-bold">{t("program.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("program.subtitle")}</p>

        <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)} className="mt-4">
          {/* Tabs come first and look like tabs: icon, label, and a clear line under the active one. */}
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-none border-b border-border bg-transparent p-0">
            {tabs.map((id) => {
              const Icon = TAB_ICONS[id];
              return (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="touch-action flex flex-col items-center gap-1 whitespace-normal rounded-none border-b-2 border-transparent bg-transparent px-1 py-3 text-center text-xs font-semibold leading-tight text-muted-foreground shadow-none focus-visible:ring-inset focus-visible:ring-offset-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{t(`program.tab.${id}` as TranslationKey)}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* The preview follows the tabs. It stays in view only while designing, and is hidden on the growth tab. */}
          {tab !== "growth" && (
            <div className={`${tab === "design" ? "sticky top-0 z-20" : ""} -mx-5 mt-3 bg-background/90 px-5 pb-3 pt-2 backdrop-blur`}>
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

          <TabsContent value="design" className="mt-4">
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
            <TabsContent value="design" className="mt-4 space-y-4">
              <SettingsCard title={t("program.name")}>
                <input id="programName" aria-label={t("program.name")} value={programName} onChange={(event) => setProgramName(event.target.value)} className={INPUT} />
              </SettingsCard>

              <SettingsCard title={t("program.stampIcon")}>
                <StampIconPicker value={stampIcon} onChange={setStampIcon} logoUrl={previewLogo} />
              </SettingsCard>

              <SettingsCard title={t("program.cardTheme")}>
                <div className="grid grid-cols-7 gap-1.5">
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
                      className={`touch-action relative aspect-square w-full rounded-full border border-border ring-offset-2 ring-offset-card ${cardTheme === theme ? "ring-2 ring-ring" : ""}`}
                    >
                      <span data-card-theme={theme} className="card-theme-swatch absolute inset-0.5 rounded-full" aria-hidden="true" />
                      {cardTheme === theme && <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
                <p className="text-xs font-semibold text-muted-foreground">{t(`cardTheme.${cardTheme}` as TranslationKey)}</p>

                <details className="group border-t border-border pt-1" open={hasCustomColors}>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      {t("program.customColors")}
                      {hasCustomColors && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
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
              </SettingsCard>
            </TabsContent>

            <TabsContent value="reward" className="mt-4 min-w-0 space-y-4">
              <SettingsCard title={t("program.reward")}>
                <input
                  id="rewardName"
                  aria-label={t("program.reward")}
                  value={rewardName}
                  onChange={(event) => setRewardName(event.target.value)}
                  placeholder={t("onboarding.program.rewardPlaceholder")}
                  className={INPUT}
                />
                <div>
                  <label htmlFor="rewardDescription" className="text-xs font-semibold text-muted-foreground">
                    {t("program.rewardDescription")}
                  </label>
                  <textarea id="rewardDescription" value={rewardDescription} onChange={(event) => setRewardDescription(event.target.value)} rows={2} className={`mt-1 ${INPUT}`} />
                </div>
                <div>
                  <label htmlFor="stampsRequired" className="text-xs font-semibold text-muted-foreground">
                    {t("program.stamps")}
                  </label>
                  <div className="mt-1 flex items-center gap-3">
                    <Button type="button" aria-label={t("program.decrease")} onClick={() => changeStamps(-1)} variant="secondary" size="icon" className="touch-action h-11 w-11 shrink-0">
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
                      className="w-20 rounded-md border border-border bg-background px-4 py-3 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Button type="button" aria-label={t("program.increase")} onClick={() => changeStamps(1)} variant="secondary" size="icon" className="touch-action h-11 w-11 shrink-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard
                title={t("program.joinBonus.title")}
                description={t("program.joinBonus.hint")}
                action={
                  <span className="relative inline-flex shrink-0">
                    <Switch
                      id="joinBonusOn"
                      checked={joinBonusOn}
                      onCheckedChange={(checked) => {
                        setJoinBonusOn(checked);
                        if (checked && (Number(joinBonusText) || 0) < 1) setJoinBonusText("1");
                      }}
                      aria-label={t("program.joinBonus.toggle")}
                    />
                  </span>
                }
              >
                {joinBonusOn && (
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="joinBonusCount" className="min-w-0 text-sm font-semibold">
                      {t("program.joinBonus.count")}
                    </label>
                    <input
                      id="joinBonusCount"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={Math.max(1, Math.min(20, clampStamps(stampsText, stampsRequired) - 1))}
                      value={joinBonusText}
                      onChange={(event) => setJoinBonusText(event.target.value)}
                      className="w-20 rounded-md border border-border bg-background px-3 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                )}
              </SettingsCard>

              <SettingsCard title={t("program.cooldown")} description={t("program.cooldownHint")}>
                <input
                  id="cooldown"
                  aria-label={t("program.cooldown")}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={1440}
                  value={cooldownText}
                  onChange={(event) => setCooldownText(event.target.value)}
                  className="w-28 rounded-md border border-border bg-background px-4 py-3 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </SettingsCard>
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

          <TabsContent value="reward" className="mt-4">
            <RewardsManager rewards={data.rewards} cardStamps={data.program?.stamps_required ?? 10} />
          </TabsContent>
          <TabsContent value="growth" className="mt-4">
            <ReferralSettings program={data.program} />
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
