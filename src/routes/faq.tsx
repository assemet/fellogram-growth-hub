import { createFileRoute } from "@tanstack/react-router";
import { Mail } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AppHeader } from "@/components/BrandMark";
import { BackLink } from "@/components/BackLink";
import { BottomNav } from "@/components/BottomNav";
import { LegalLinks } from "@/components/LegalLinks";
import { SettingsCard } from "@/components/SettingsCard";
import { Button } from "@/components/ui/button";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { useMyContext } from "@/hooks/useMyContext";
import { getLocale, t } from "@/lib/i18n";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/support";

export const Route = createFileRoute("/faq")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Help & FAQ — Fellogram" },
      { name: "description", content: "Answers to common questions about Fellogram." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FaqPage,
});

const CUSTOMER_QUESTIONS = [1, 2, 3, 4, 5] as const;
const STORE_QUESTIONS = [6, 7, 8, 9] as const;

function QuestionList({ title, numbers }: { title: string; numbers: readonly (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)[] }) {
  return (
    <SettingsCard title={title}>
      <Accordion type="single" collapsible className="-my-2">
        {numbers.map((n) => (
          <AccordionItem key={n} value={`q${n}`} className="last:border-b-0">
            <AccordionTrigger className="gap-3 text-start text-sm font-semibold">{t(`faq.q${n}`)}</AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{t(`faq.a${n}`)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </SettingsCard>
  );
}

function FaqPage() {
  const { state } = useFellogramAuth();
  const { data: context } = useMyContext(state === "ready");

  const role = context?.ownedStoreId ? "owner" : context?.staffStoreId ? "cashier" : "customer";
  const mailto = SUPPORT_EMAIL
    ? supportMailto(SUPPORT_EMAIL, {
        subject: t("faq.contact.subject"),
        intro: t("faq.contact.intro"),
        locale: getLocale(),
        role,
        userId: context?.profile?.id,
        storeId: context?.ownedStoreId ?? context?.staffStoreId,
      })
    : null;

  return (
    <main className="min-h-screen pb-14">
      <AppHeader />

      <section className="app-shell space-y-4">
        <BackLink to="/settings">{t("settings.title")}</BackLink>
        <div>
          <h1 className="text-xl font-bold">{t("faq.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("faq.subtitle")}</p>
        </div>

        <QuestionList title={t("faq.customers")} numbers={CUSTOMER_QUESTIONS} />
        <QuestionList title={t("faq.stores")} numbers={STORE_QUESTIONS} />

        {mailto && (
          <SettingsCard title={t("faq.contact.title")} description={t("faq.contact.body")}>
            <Button asChild className="touch-action h-12 w-full gap-2 font-bold">
              <a href={mailto}>
                <Mail className="h-4 w-4" aria-hidden="true" />
                {t("faq.contact.button")}
              </a>
            </Button>
          </SettingsCard>
        )}

        <LegalLinks className="justify-center" />
      </section>

      <BottomNav current="settings" />
    </main>
  );
}
