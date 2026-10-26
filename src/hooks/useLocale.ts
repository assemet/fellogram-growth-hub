import { useSyncExternalStore } from "react";

import { getLocale, subscribeLocale, type Locale } from "@/lib/i18n";

/** Current UI language; components using t() re-render when it changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, () => "en" as Locale);
}
