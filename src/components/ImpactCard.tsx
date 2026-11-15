import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { BellRing, Gift, Repeat } from "lucide-react";

import { t } from "@/lib/i18n";
import { getStoreImpact } from "@/lib/insights.functions";

/** "+3", "−2" or "no change", with a real minus sign. */
function deltaText(now: number, prev: number): string {
  const diff = now - prev;
  if (diff === 0) return t("impact.same");
  return diff > 0 ? `+${diff}` : `\u2212${Math.abs(diff)}`;
}

function Row({ icon, value, label, sub, tone }: { icon: React.ReactNode; value: number; label: string; sub: string; tone?: "up" | undefined }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
          <span className={`text-2xl font-extrabold tabular-nums ${tone === "up" ? "text-growth" : "text-foreground"}`}>{value}</span>{" "}
          <span>{sub}</span>
        </p>
      </div>
    </li>
  );
}

/**
 * The owner's proof that the app earns its keep: who came back, who came back after a reminder, what left the
 * store. Counts only, compared with the period before. Hidden until there is activity, or if the database
 * function is not installed yet.
 */
export function ImpactCard() {
  const load = useServerFn(getStoreImpact);
  const { data } = useQuery({ queryKey: ["store-impact"], queryFn: () => load(), staleTime: 60_000 });
  if (!data?.supported) return null;
  const a = data.impact;
  if (a.visits.now + a.visits.prev === 0) return null;

  return (
    <section className="mt-7 animate-arrive rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]" aria-label={t("impact.title")}>
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-lg font-bold leading-tight">{t("impact.title")}</h2>
        <p className="shrink-0 text-xs text-muted-foreground">{t("impact.period", { days: a.days })}</p>
      </div>

      <ul className="mt-2 divide-y divide-border">
        <Row
          icon={<Repeat className="h-5 w-5" />}
          value={a.returning.now}
          label={t("impact.returning.label")}
          sub={t("impact.vs", { delta: deltaText(a.returning.now, a.returning.prev), days: a.days })}
          tone={a.returning.now > a.returning.prev ? "up" : undefined}
        />
        {a.reminded > 0 ? (
          <Row
            icon={<BellRing className="h-5 w-5" />}
            value={a.wonBack}
            label={t("impact.wonBack.label")}
            sub={t("impact.wonBack.sub", { reminded: a.reminded })}
            tone={a.wonBack > 0 ? "up" : undefined}
          />
        ) : (
          <li className="flex items-start gap-3 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden="true">
              <BellRing className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-muted-foreground">{t("impact.wonBack.label")}</p>
              <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{t("impact.wonBack.none")}</p>
              <Link to="/merchant/customers" className="touch-action mt-1 inline-block text-sm font-semibold text-primary">
                {t("impact.wonBack.action")}
              </Link>
            </div>
          </li>
        )}
        <Row
          icon={<Gift className="h-5 w-5" />}
          value={a.rewards + a.offersUsed}
          label={t("impact.out.label")}
          sub={t("impact.out.sub", { rewards: a.rewards, offers: a.offersUsed })}
        />
      </ul>

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("impact.note")}</p>
    </section>
  );
}
