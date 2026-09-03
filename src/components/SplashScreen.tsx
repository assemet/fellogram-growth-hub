import { t } from "@/lib/i18n";

export function SplashScreen({ message }: { message?: string }) {
  return (
    <div className="brand-surface flex min-h-screen flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="animate-in fade-in zoom-in-95 flex flex-col items-center gap-4 duration-700">
        <img
          src="/logo.png"
          alt={t("app.name")}
          className="h-28 w-28 rounded-3xl bg-card object-contain p-2 shadow-[var(--shadow-float)]"
        />
        <h1 className="font-display text-2xl font-bold">{t("app.name")}</h1>
        <p className="text-sm opacity-90">{t("app.tagline")}</p>
      </div>
      <p className="animate-in fade-in text-xs opacity-75 delay-500 duration-1000">
        {message ?? t("app.loading")}
      </p>
    </div>
  );
}
