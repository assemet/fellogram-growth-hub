import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AppHeader } from "@/components/BrandMark";
import { getLocale, t } from "@/lib/i18n";
import { LEGAL_UPDATED, legalContent, type LegalDoc } from "@/lib/legal";
import { SUPPORT_EMAIL } from "@/lib/support";

/** A public page (no sign-in needed) that shows one legal text in the person's language. */
export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const router = useRouter();
  const locale = getLocale();
  const content = legalContent(locale);
  const doc: LegalDoc = content[kind];
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(`${LEGAL_UPDATED}T00:00:00`));
  const contact = SUPPORT_EMAIL ? doc.contact.withEmail.replace("{email}", SUPPORT_EMAIL) : doc.contact.withoutEmail;

  return (
    <main className="min-h-screen pb-10">
      <AppHeader />

      <article className="app-shell">
        <button
          type="button"
          onClick={() => router.history.back()}
          className="touch-action inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-bold text-secondary-foreground shadow-sm transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
          {t("onboarding.back")}
        </button>

        <h1 className="mt-3 text-xl font-bold">{doc.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {content.updated}: {updated}
        </p>
        <p className="mt-3 text-sm leading-relaxed">{doc.intro}</p>

        {doc.sections.map((section, index) => (
          <section key={section.heading} className="mt-6">
            <h2 className="text-base font-bold">
              {index + 1}. {section.heading}
            </h2>
            {section.lead && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.lead}</p>}
            {section.bullets && (
              <ul className="mt-2 list-disc space-y-1.5 ps-5 text-sm leading-relaxed text-muted-foreground">
                {section.bullets.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            )}
            {section.paragraphs?.map((text) => (
              <p key={text} className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {text}
              </p>
            ))}
          </section>
        ))}

        <section className="mt-6">
          <h2 className="text-base font-bold">{doc.contact.heading}</h2>
          <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">{contact}</p>
        </section>
      </article>
    </main>
  );
}
