import { Facebook, Mail, MessageCircle, MessageSquareText, MoreHorizontal, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { isInsideTelegram, openExternalLink, shareViaTelegram } from "@/lib/telegram";

const tile = "touch-action flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-2 text-center text-xs font-semibold text-foreground";

/** Lets the person pick where to share the join link: the phone's own share menu, Telegram, WhatsApp, SMS or email. */
export function ShareLinkSheet({ link, text, subject, onClose }: { link: string; text: string; subject: string; onClose: () => void }) {
  const message = `${text} ${link}`;
  // Inside Telegram, sms: and mailto: links fail ("unknown URL scheme"), so only web-based options are offered there.
  const inTelegram = isInsideTelegram();
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const nativeShare = async () => {
    try {
      await navigator.share({ title: subject, text, url: link });
      onClose();
    } catch (error) {
      if ((error as { name?: string } | null)?.name !== "AbortError") shareViaTelegram(link, text);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4 sm:items-center" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="animate-arrive w-full max-w-sm rounded-lg border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-float)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold">{t("join.share.choose")}</p>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t("rewards.close")}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" className={tile} onClick={() => { shareViaTelegram(link, text); onClose(); }}>
            <Send className="h-5 w-5 text-primary" aria-hidden="true" />
            Telegram
          </button>
          <button type="button" className={tile} onClick={() => { openExternalLink(`https://wa.me/?text=${encodeURIComponent(message)}`); onClose(); }}>
            <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
            WhatsApp
          </button>
          {inTelegram ? (
            <button
              type="button"
              className={tile}
              onClick={() => { openExternalLink(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`); onClose(); }}
            >
              <Facebook className="h-5 w-5 text-primary" aria-hidden="true" />
              Facebook
            </button>
          ) : (
            <>
              <a className={tile} href={`sms:?&body=${encodeURIComponent(message)}`} onClick={onClose}>
                <MessageSquareText className="h-5 w-5 text-primary" aria-hidden="true" />
                {t("join.share.sms")}
              </a>
              <a className={tile} href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`} onClick={onClose}>
                <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
                {t("join.share.email")}
              </a>
            </>
          )}
          {canNativeShare && (
            <button type="button" className={tile} onClick={nativeShare}>
              <MoreHorizontal className="h-5 w-5 text-primary" aria-hidden="true" />
              {t("join.share.more")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
