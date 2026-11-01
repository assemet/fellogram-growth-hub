/** Bot message texts (pure, so they are easy to test). Telegram parse mode is HTML, so names are escaped. */
export type NotifyLocale = "ar" | "en";
export type StampKind = "stamp" | "near_reward" | "reward_ready";

export function localeFor(languageCode: string | null | undefined): NotifyLocale {
  return String(languageCode ?? "").toLowerCase().startsWith("ar") ? "ar" : "en";
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}

/** Which message a customer gets after a stamp: plain receipt, "one to go", or reward ready. */
export function stampKind(balance: number, required: number): StampKind {
  if (balance >= required) return "reward_ready";
  if (balance === required - 1) return "near_reward";
  return "stamp";
}

type Info = { store: string; balance: number; required: number };

export function stampMessage(locale: NotifyLocale, kind: StampKind, info: Info): string {
  const store = `<b>${escapeHtml(info.store)}</b>`;
  const progress = `${info.balance}/${info.required}`;
  if (locale === "ar") {
    if (kind === "reward_ready") return `🎉 مكافأتك جاهزة في ${store}!\nلديك ${progress} من الطوابع. أظهر رمزك للكاشير لاستلامها.`;
    if (kind === "near_reward") return `🔥 ${store}: تمت إضافة طابع (${progress}).\nتبقّى طابع واحد فقط لمكافأتك!`;
    return `✅ ${store}: تمت إضافة طابع (${progress}).`;
  }
  if (kind === "reward_ready") return `🎉 Your reward is ready at ${store}!\nYou have ${progress} stamps. Show your QR to the cashier to claim it.`;
  if (kind === "near_reward") return `🔥 ${store}: stamp added (${progress}).\nJust one more stamp to your reward!`;
  return `✅ ${store}: stamp added (${progress}).`;
}

export function reminderMessage(locale: NotifyLocale, info: Info): string {
  const store = `<b>${escapeHtml(info.store)}</b>`;
  const progress = `${info.balance}/${info.required}`;
  return locale === "ar"
    ? `👋 اشتقنا لك في ${store}!\nبطاقتك عند ${progress} من الطوابع، وننتظر زيارتك قريباً.`
    : `👋 We miss you at ${store}!\nYour card is at ${progress} stamps. We'd love to see you again soon.`;
}

export function enabledMessage(locale: NotifyLocale): string {
  return locale === "ar"
    ? "🔔 تم تفعيل الإشعارات. ستصلك هنا أخبار طوابعك ومكافآتك."
    : "🔔 Notifications are on. You'll get your stamp and reward updates here.";
}

export function openCardLabel(locale: NotifyLocale): string {
  return locale === "ar" ? "افتح بطاقتي" : "Open my card";
}
