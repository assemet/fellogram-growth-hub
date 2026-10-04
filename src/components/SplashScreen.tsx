import { t } from "@/lib/i18n";

export function SplashScreen({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-8 text-center text-foreground">
      <div className="animate-splash-wordmark flex flex-col items-center gap-2">
        <h1 className="font-display text-4xl font-bold">{t("app.name")}</h1>
        <p className="text-sm font-medium text-muted-foreground">{t("app.tagline")}</p>
      </div>
      <p className="mt-10 animate-arrive text-xs text-muted-foreground">
        {message ?? t("app.loading")}
      </p>
    </div>
  );
}
