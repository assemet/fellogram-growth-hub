import { Link } from "@tanstack/react-router";

import { getLocale } from "@/lib/i18n";
import { legalContent } from "@/lib/legal";

/** "Privacy policy · Terms of use" as two small links, in the person's language. */
export function LegalLinks({ className = "" }: { className?: string }) {
  const content = legalContent(getLocale());
  const link = "touch-action inline-flex min-h-11 items-center px-1 text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground";
  return (
    <nav className={`flex flex-wrap items-center gap-x-3 ${className}`}>
      <Link to="/privacy" className={link}>
        {content.privacy.title}
      </Link>
      <Link to="/terms" className={link}>
        {content.terms.title}
      </Link>
    </nav>
  );
}
