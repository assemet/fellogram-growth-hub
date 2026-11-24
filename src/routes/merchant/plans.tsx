import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Lock, Share2 } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/BrandMark";
import { BackLink } from "@/components/BackLink";
import { BottomNav } from "@/components/BottomNav";
import { SplashScreen } from "@/components/SplashScreen";
import { Button } from "@/components/ui/button";
import { useMyPlan } from "@/hooks/useMyPlan";
import { PLAN_FEATURES } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { getLocale, t, type TranslationKey } from "@/lib/i18n";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/support";
import { useMyContext } from "@/hooks/useMyContext";
import { shareViaTelegram } from "@/lib/telegram";

export const Route = createFileRoute("/merchant/plans")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Plans — Fellogram" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const { plan, isLoading } = useMyPlan();
  const context = useMyContext();
  if (isLoading || !plan) return <SplashScreen />;

  const mailto = SUPPORT_EMAIL
    ? supportMailto(SUPPORT_EMAIL, {
        subject: "Fellogram — plan",
        intro: "I would like to change my plan.",
        locale: getLocale(),
        role: "owner",
        userId: context.data?.profile?.id ?? null,
        storeId: context.data?.ownedStoreId ?? null,
      })
    : null;

  return (
    <main className="min-h-[100dvh] pb-24">
      <AppHeader />
      <section className="app-shell space-y-4">
        <BackLink to="/merchant">{t("merchant.title")}</BackLink>
        <div>
          <h1 className="text-xl font-extrabold">{t("plans.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("plans.subtitle")}</p>
        </div>

        {!plan.enforced ? (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">{t("plans.open")}</p>
        ) : (
          <>
            <ul className="space-y-3">
              {plan.plans.map((card) => {
                const mine = card.code === plan.current.code;
                return (
                  <li key={card.code} className={`rounded-lg border bg-card p-4 shadow-[var(--shadow-card)] ${mine ? "border-primary" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-base font-bold">{card.name}</h2>
                        <p className="text-sm text-muted-foreground">{card.price === 0 ? t("plans.priceFree") : t("plans.price", { price: card.price })}</p>
                      </div>
                      {mine && <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">{t("plans.current")}</span>}
                    </div>
                    {mine && plan.current.endsAt && <p className="mt-1 text-xs text-muted-foreground">{t(plan.current.trial ? "plans.trial" : "plans.until", { date: formatDate(plan.current.endsAt) })}</p>}
                    <p className="mt-2 text-xs font-semibold">{t("plans.cashiers", { count: card.maxCashiers })}</p>
                    <ul className="mt-2 space-y-1.5">
                      {PLAN_FEATURES.map((feature) => {
                        const has = card.features.includes(feature.key);
                        return (
                          <li key={feature.key} className={`flex items-start gap-2 text-sm ${has ? "" : "text-muted-foreground/70"}`}>
                            {has ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-growth" aria-hidden="true" /> : <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
                            <span>{t(`plans.feature.${feature.key}` as TranslationKey)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
            {plan.referral && (
              <div className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-base font-bold">{t("plans.referral.title")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("plans.referral.body", { months: plan.referral.rewardMonths })}</p>
                <p className="mt-2 text-xs font-semibold">
                  {t("plans.referral.stats", { invited: plan.referral.invited, rewarded: plan.referral.rewarded, earned: plan.referral.earnedMonths })}
                </p>
                {plan.referral.capMonths > 0 && <p className="mt-1 text-xs text-muted-foreground">{t("plans.referral.cap", { cap: plan.referral.capMonths })}</p>}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="touch-action h-11 gap-2 text-xs font-semibold"
                    onClick={() => {
                      void navigator.clipboard.writeText(plan.referral!.link).then(() => toast.success(t("plans.referral.copied")));
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    {t("plans.referral.copy")}
                  </Button>
                  <Button type="button" className="touch-action h-11 gap-2 text-xs font-semibold" onClick={() => shareViaTelegram(plan.referral!.link, t("plans.referral.shareText"))}>
                    <Share2 className="h-4 w-4" />
                    {t("plans.referral.share")}
                  </Button>
                </div>
              </div>
            )}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">{t("plans.howTo")}</p>
              {mailto && (
                <a href={mailto} className="touch-action mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary">
                  {t("plans.contact")}
                </a>
              )}
            </div>
          </>
        )}
      </section>
      <BottomNav current="merchant" />
    </main>
  );
}
