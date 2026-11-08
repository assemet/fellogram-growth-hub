import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { DeleteAccountSection, LeaveTeamRow } from "@/components/AccountDangerZone";
import { AppHeader } from "@/components/BrandMark";
import { BottomNav } from "@/components/BottomNav";
import { LanguagePicker } from "@/components/LanguageControls";
import { QueryError } from "@/components/QueryError";
import { SettingsCard } from "@/components/SettingsCard";
import { StartStoreCard } from "@/components/StartStoreCard";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SplashScreen } from "@/components/SplashScreen";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { useMyContext } from "@/hooks/useMyContext";
import { useNotifications } from "@/hooks/useNotifications";
import { t } from "@/lib/i18n";
import {
  readAppearance,
  readBool,
  readTextSize,
  setAppearance,
  setTextSize,
  writeBool,
  type Appearance,
  type BoolPref,
  type TextSize,
} from "@/lib/prefs";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — Fellogram" },
      { name: "description", content: "Language, appearance and notifications." },
      { property: "og:title", content: "Settings — Fellogram" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const BOT = String(import.meta.env["VITE_TELEGRAM_BOT_USERNAME"] ?? "fellogram_bot").replace(/^@/, "").trim();

function SwitchRow({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="min-w-0 text-sm font-medium">{label}</span>
      <Switch checked={checked} disabled={disabled ?? false} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function SettingsPage() {
  const { state } = useFellogramAuth();
  const { data: context, error, refetch } = useMyContext(state === "ready");
  const { data: notifications, needsStart, enableMutation, disableMutation } = useNotifications();

  const [appearance, setAppearanceState] = useState<Appearance>(readAppearance);
  const [textSize, setTextSizeState] = useState<TextSize>(readTextSize);
  const [prefs, setPrefs] = useState<Record<BoolPref, boolean>>(() => ({
    autoStamp: readBool("autoStamp"),
    sound: readBool("sound"),
    vibration: readBool("vibration"),
  }));

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (state !== "ready" || !context) return <SplashScreen />;

  const isOwner = Boolean(context.ownedStoreId);
  const isTeam = isOwner || Boolean(context.staffStoreId);
  const bot = notifications?.bot ?? BOT;

  const togglePref = (pref: BoolPref, value: boolean) => {
    writeBool(pref, value);
    setPrefs((current) => ({ ...current, [pref]: value }));
  };

  return (
    <main className="min-h-screen pb-14">
      <AppHeader />

      <section className="app-shell space-y-4">
        <h1 className="text-xl font-bold">{t("settings.title")}</h1>

        {!isOwner && <StartStoreCard />}

        <SettingsCard title={t("settings.language")}>
          <LanguagePicker />
        </SettingsCard>

        <SettingsCard title={t("settings.appearance")} description={t("settings.appearance.hint")}>
          <SegmentedControl<Appearance>
            label={t("settings.appearance")}
            value={appearance}
            onChange={(next) => {
              setAppearanceState(next);
              setAppearance(next);
            }}
            options={[
              { value: "auto", label: t("settings.appearance.auto") },
              { value: "light", label: t("settings.appearance.light") },
              { value: "dark", label: t("settings.appearance.dark") },
            ]}
          />
          <div>
            <p className="mb-2 text-sm font-medium">{t("settings.textSize")}</p>
            <SegmentedControl<TextSize>
              label={t("settings.textSize")}
              value={textSize}
              onChange={(next) => {
                setTextSizeState(next);
                setTextSize(next);
              }}
              options={[
                { value: "normal", label: t("settings.textSize.normal") },
                { value: "large", label: t("settings.textSize.large") },
              ]}
            />
          </div>
        </SettingsCard>

        {notifications?.supported && (
          <SettingsCard title={t("settings.notifications")} description={t("settings.notifications.hint")}>
            <SwitchRow
              label={t("settings.notifications")}
              checked={notifications.enabled}
              disabled={enableMutation.isPending || disableMutation.isPending}
              onChange={(next) => (next ? enableMutation.mutate() : disableMutation.mutate())}
            />
            {needsStart && (
              <div className="space-y-2">
                <p role="alert" className="rounded-md bg-muted px-3 py-2 text-xs font-semibold">
                  {t("notify.blocked")}
                </p>
                <Button asChild variant="outline" className="touch-action h-11 w-full font-semibold">
                  <a href={`https://t.me/${bot}`}>{t("notify.openBot")}</a>
                </Button>
              </div>
            )}
          </SettingsCard>
        )}

        {isTeam && (
          <SettingsCard title={t("settings.cashier")} description={t("settings.cashier.hint")}>
            <SwitchRow label={t("cashier.autoStamp")} checked={prefs.autoStamp} onChange={(next) => togglePref("autoStamp", next)} />
            <SwitchRow label={t("settings.sound")} checked={prefs.sound} onChange={(next) => togglePref("sound", next)} />
            <SwitchRow label={t("settings.vibration")} checked={prefs.vibration} onChange={(next) => togglePref("vibration", next)} />
            {!isOwner && context.staffStoreName && <LeaveTeamRow storeName={context.staffStoreName} />}
          </SettingsCard>
        )}

        <SettingsCard title={t("settings.data")}>
          <p className="text-sm font-semibold text-destructive">{t("settings.delete.title")}</p>
          <DeleteAccountSection isOwner={isOwner} />
        </SettingsCard>

        <SettingsCard title={t("settings.about")}>
          <div>
            <p className="font-display text-lg font-bold">{t("app.name")}</p>
            <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
          </div>
          <Button asChild variant="outline" className="touch-action h-11 w-full font-semibold">
            <a href={`https://t.me/${bot}`}>{t("notify.openBot")}</a>
          </Button>
        </SettingsCard>
      </section>

      <BottomNav current="settings" />
    </main>
  );
}
