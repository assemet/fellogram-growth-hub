import { AppHeader } from "@/components/BrandMark";
import { t } from "@/lib/i18n";

/** In-app loading state: the real header stays, only the content area pulses. */
export function PageSkeleton() {
  return (
    <main className="min-h-[100dvh] pb-14" aria-busy="true">
      <AppHeader />
      <section className="app-shell space-y-4" role="status">
        <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-36 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
        <span className="sr-only">{t("app.loading")}</span>
      </section>
    </main>
  );
}
