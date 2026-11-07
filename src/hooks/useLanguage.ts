import { useServerFn } from "@tanstack/react-start";

import { useLocale } from "@/hooks/useLocale";
import { setLocale, type Locale } from "@/lib/i18n";
import { saveLanguage } from "@/lib/notifications.functions";

/** The current language and a way to change it: saved on this device (kept until changed) and on the account. */
export function useLanguage() {
  const locale = useLocale();
  const save = useServerFn(saveLanguage);
  const change = (next: Locale) => {
    setLocale(next);
    void save({ data: { locale: next } }).catch(() => undefined);
  };
  return { locale, change };
}
