import { t } from "@/lib/i18n";

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt={t("app.name")}
      width={size}
      height={size}
      className="rounded-2xl object-contain"
      style={{ width: size, height: size }}
    />
  );
}

export function AppHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="app-shell flex items-center gap-3 pt-6 pb-4">
      <BrandMark size={40} />
      <div>
        <p className="font-display text-lg leading-none font-bold">{t("app.name")}</p>
        <p className="text-xs text-muted-foreground">{subtitle ?? t("app.tagline")}</p>
      </div>
    </header>
  );
}
