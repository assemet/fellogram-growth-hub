import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { isAuthBlocked, subscribeAuthBlocked } from "@/lib/auth-block";
import { t } from "@/lib/i18n";

const BOT = String(import.meta.env["VITE_TELEGRAM_BOT_USERNAME"] ?? "fellogram_bot").replace(/^@/, "").trim();
const SHORT_NAME = String(import.meta.env["VITE_TELEGRAM_MINIAPP_SHORTNAME"] ?? "fello").trim();

/** Shown instead of the app when it is opened outside Telegram (the shared preview account is off in production). */
export function TelegramRequired() {
  const blocked = useSyncExternalStore(subscribeAuthBlocked, isAuthBlocked, () => false);
  if (!blocked) return null;
  const link = SHORT_NAME && SHORT_NAME.toLowerCase() !== "main" ? `https://t.me/${BOT}/${SHORT_NAME}` : `https://t.me/${BOT}`;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background px-6 text-center" role="alert">
      <h1 className="font-display text-2xl font-bold">{t("auth.telegramOnly.title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("auth.telegramOnly.body")}</p>
      <Button asChild className="touch-action h-12 px-6 text-base font-bold">
        <a href={link}>{t("auth.telegramOnly.open")}</a>
      </Button>
    </div>
  );
}
