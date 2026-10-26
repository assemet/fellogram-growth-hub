import { AppHeader } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Full-screen failure state: says what happened, shows the technical reason, lets the user retry. */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const reason = String((error as { message?: unknown } | null)?.message ?? error ?? "");
  return (
    <main className="min-h-[100dvh] pb-14">
      <AppHeader />
      <section className="app-shell">
        <div role="alert" className="rounded-lg border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
          <p className="font-semibold">{t("error.load.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("error.load.body")}</p>
          {reason && (
            <p dir="ltr" className="mt-3 break-all rounded-md bg-muted px-3 py-2 text-start font-mono text-[11px] text-muted-foreground">
              {reason}
            </p>
          )}
          <Button type="button" onClick={onRetry} className="touch-action mt-4 h-12 px-6 font-bold">
            {t("wallet.error.retry")}
          </Button>
        </div>
      </section>
    </main>
  );
}
