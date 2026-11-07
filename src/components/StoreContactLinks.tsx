import { Facebook, Globe, Instagram, MapPin, MessageCircle, Music2, Phone, Send } from "lucide-react";

import { t, type TranslationKey } from "@/lib/i18n";
import { contactLinks, type ContactField, type ContactLinkKind } from "@/lib/store-contact";
import { openExternalLink } from "@/lib/telegram";

const ICONS = { call: Phone, whatsapp: MessageCircle, telegram: Send, instagram: Instagram, facebook: Facebook, tiktok: Music2, website: Globe, maps: MapPin } as const;
const LABELS: Record<ContactLinkKind, TranslationKey> = {
  call: "contact.call",
  whatsapp: "contact.whatsapp",
  telegram: "contact.telegram",
  instagram: "contact.instagram",
  facebook: "contact.facebook",
  tiktok: "contact.tiktok",
  website: "contact.website",
  maps: "contact.map",
};

/**
 * How a customer reaches the store: call, WhatsApp, Telegram, social pages, website, map. Every link is rebuilt
 * from validated values (see store-contact.ts), so nothing a store typed can become an unsafe link.
 */
export function StoreContactLinks({ contact, className = "" }: { contact?: Partial<Record<ContactField, string | null>> | undefined; className?: string }) {
  const links = contactLinks(contact ?? {});
  const address = contact?.address?.trim();
  if (links.length === 0 && !address) return null;

  return (
    <section aria-label={t("contact.title")} className={`rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)] ${className}`}>
      <h2 className="text-sm font-bold">{t("contact.title")}</h2>
      {address && (
        <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{address}</span>
        </p>
      )}
      {links.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {links.map((link) => {
            const Icon = ICONS[link.kind];
            return (
              <li key={link.kind} className="min-w-0">
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => {
                    // Phone links must stay normal links; everything else opens the way Telegram expects.
                    if (link.kind === "call") return;
                    event.preventDefault();
                    openExternalLink(link.href);
                  }}
                  className="touch-action flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground"
                >
                  <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 truncate">{t(LABELS[link.kind])}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
