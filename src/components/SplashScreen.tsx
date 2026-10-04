import { t } from "@/lib/i18n";

export function SplashScreen({ message }: { message?: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-background px-8 text-center text-foreground">
      <div className="animate-splash flex flex-col items-center gap-3">
        <img
          src="/logo.png"
          alt={t("app.name")}
          className="h-40 w-40 rounded-2xl object-contain shadow-[var(--shadow-card)] sm:h-48 sm:w-48"
        />
        <h1 className="font-display text-3xl font-bold">{t("app.name")}</h1>
        <p className="text-sm font-semibold text-muted-foreground">{t("app.tagline")}</p>
      </div>
      <p className="animate-arrive text-xs text-muted-foreground">
        {message ?? t("app.loading")}
      </p>
    </div>
  );
}
