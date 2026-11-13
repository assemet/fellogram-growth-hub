/** Bot message texts (pure, so they are easy to test). Telegram parse mode is HTML, so names are escaped. */
export const NOTIFY_LOCALES = ["ar", "en", "ru", "es", "tr"] as const;
export type NotifyLocale = (typeof NOTIFY_LOCALES)[number];
export type StampKind = "stamp" | "near_reward" | "reward_ready";

/** "ru-RU" → "ru". A language we do not write messages in gets English. */
export function localeFor(languageCode: string | null | undefined): NotifyLocale {
  const primary = String(languageCode ?? "").trim().toLowerCase().replace("_", "-").split("-")[0] ?? "";
  return (NOTIFY_LOCALES as readonly string[]).includes(primary) ? (primary as NotifyLocale) : "en";
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

/** `store` arrives already bold and escaped, `progress` is "balance/required". */
type Texts = {
  stamp: (store: string, progress: string) => string;
  near: (store: string, progress: string) => string;
  ready: (store: string, progress: string) => string;
  reminder: (store: string, progress: string) => string;
  rewardWaiting: (store: string, progress: string) => string;
  redeemed: (store: string) => string;
  reviewInvite: string;
  rate: string;
  enabled: string;
  open: string;
};

const TEXTS: Record<NotifyLocale, Texts> = {
  en: {
    stamp: (s, p) => `✅ ${s}: stamp added (${p}).`,
    near: (s, p) => `🔥 ${s}: stamp added (${p}).\nJust one more stamp to your reward!`,
    ready: (s, p) => `🎉 Your reward is ready at ${s}!\nYou have ${p} stamps. Show your QR to the cashier to claim it.`,
    reminder: (s, p) => `👋 We miss you at ${s}!\nYour card is at ${p} stamps. We'd love to see you again soon.`,
    rewardWaiting: (s, p) => `🎁 Your reward is waiting at ${s}!\nYour card is complete (${p}). Show your QR to the cashier to collect it.`,
    redeemed: (s) => `🎁 ${s}: reward collected. Enjoy!`,
    reviewInvite: "Enjoyed your visit? Share your opinion if you like. It's optional.",
    rate: "Rate us",
    enabled: "🔔 Notifications are on. You'll get your stamp and reward updates here.",
    open: "Open my card",
  },
  ar: {
    stamp: (s, p) => `✅ ${s}: تمت إضافة طابع (${p}).`,
    near: (s, p) => `🔥 ${s}: تمت إضافة طابع (${p}).\nتبقّى طابع واحد فقط لمكافأتك!`,
    ready: (s, p) => `🎉 مكافأتك جاهزة في ${s}!\nلديك ${p} من الطوابع. أظهر رمزك للكاشير لاستلامها.`,
    reminder: (s, p) => `👋 اشتقنا لك في ${s}!\nبطاقتك عند ${p} من الطوابع، وننتظر زيارتك قريباً.`,
    rewardWaiting: (s, p) => `🎁 مكافأتك بانتظارك في ${s}!\nبطاقتك مكتملة (${p}). أظهر رمزك للكاشير لاستلامها.`,
    redeemed: (s) => `🎁 ${s}: تم استلام المكافأة. بالهناء!`,
    reviewInvite: "إن أعجبتك زيارتك، يسعدنا أن تشاركنا رأيك. الأمر اختياري.",
    rate: "قيّمنا",
    enabled: "🔔 تم تفعيل الإشعارات. ستصلك هنا أخبار طوابعك ومكافآتك.",
    open: "افتح بطاقتي",
  },
  ru: {
    stamp: (s, p) => `✅ ${s}: штамп добавлен (${p}).`,
    near: (s, p) => `🔥 ${s}: штамп добавлен (${p}).\nОстался всего один штамп до награды!`,
    ready: (s, p) => `🎉 Ваша награда готова в ${s}!\nУ вас ${p} штампов. Покажите свой QR кассиру, чтобы получить её.`,
    reminder: (s, p) => `👋 Мы скучаем по вам в ${s}!\nНа вашей карте ${p} штампов. Будем рады видеть вас снова.`,
    rewardWaiting: (s, p) => `🎁 Ваша награда ждёт вас в ${s}!\nКарта заполнена (${p}). Покажите QR кассиру, чтобы получить её.`,
    redeemed: (s) => `🎁 ${s}: награда получена. Приятного!`,
    reviewInvite: "Понравился визит? Поделитесь мнением, если хотите. Это необязательно.",
    rate: "Оценить",
    enabled: "🔔 Уведомления включены. Здесь вы будете получать новости о штампах и наградах.",
    open: "Открыть мою карту",
  },
  es: {
    stamp: (s, p) => `✅ ${s}: sello añadido (${p}).`,
    near: (s, p) => `🔥 ${s}: sello añadido (${p}).\n¡Solo te falta un sello para tu recompensa!`,
    ready: (s, p) => `🎉 ¡Tu recompensa está lista en ${s}!\nTienes ${p} sellos. Muestra tu QR al cajero para canjearla.`,
    reminder: (s, p) => `👋 ¡Te echamos de menos en ${s}!\nTu tarjeta lleva ${p} sellos. Nos encantará verte pronto.`,
    rewardWaiting: (s, p) => `🎁 ¡Tu premio te espera en ${s}!\nTu tarjeta está completa (${p}). Muestra tu QR en caja para recogerlo.`,
    redeemed: (s) => `🎁 ${s}: recompensa canjeada. ¡Que la disfrutes!`,
    reviewInvite: "¿Te gustó tu visita? Cuéntanos tu opinión si quieres. Es opcional.",
    rate: "Valóranos",
    enabled: "🔔 Notificaciones activadas. Aquí recibirás novedades de tus sellos y recompensas.",
    open: "Abrir mi tarjeta",
  },
  tr: {
    stamp: (s, p) => `✅ ${s}: damga eklendi (${p}).`,
    near: (s, p) => `🔥 ${s}: damga eklendi (${p}).\nÖdülüne sadece bir damga kaldı!`,
    ready: (s, p) => `🎉 ${s} mağazasında ödülün hazır!\n${p} damgan var. Almak için QR kodunu kasiyere göster.`,
    reminder: (s, p) => `👋 ${s} seni özledi!\nKartın ${p} damgada. Seni yakında tekrar görmek isteriz.`,
    rewardWaiting: (s, p) => `🎁 Ödülün ${s} için seni bekliyor!\nKartın tamamlandı (${p}). Almak için QR kodunu kasada göster.`,
    redeemed: (s) => `🎁 ${s}: ödül alındı. Afiyet olsun!`,
    reviewInvite: "Ziyaretini beğendin mi? İstersen fikrini paylaşabilirsin. İsteğe bağlı.",
    rate: "Bizi değerlendir",
    enabled: "🔔 Bildirimler açık. Damgaların ve ödüllerinle ilgili haberleri burada alacaksın.",
    open: "Kartımı aç",
  },
};

const bold = (store: string) => `<b>${escapeHtml(store)}</b>`;
const progress = (info: Info) => `${info.balance}/${info.required}`;

export function stampMessage(locale: NotifyLocale, kind: StampKind, info: Info): string {
  const texts = TEXTS[locale];
  const render = kind === "reward_ready" ? texts.ready : kind === "near_reward" ? texts.near : texts.stamp;
  return render(bold(info.store), progress(info));
}

export function reminderMessage(locale: NotifyLocale, info: Info): string {
  return TEXTS[locale].reminder(bold(info.store), progress(info));
}

export function rewardWaitingMessage(locale: NotifyLocale, info: Info): string {
  return TEXTS[locale].rewardWaiting(bold(info.store), progress(info));
}

export function enabledMessage(locale: NotifyLocale): string {
  return TEXTS[locale].enabled;
}

export function openCardLabel(locale: NotifyLocale): string {
  return TEXTS[locale].open;
}

/** After a reward is collected. The review line only appears when the store has set a review link. */
export function redeemedMessage(locale: NotifyLocale, store: string, withReviewInvite: boolean): string {
  const texts = TEXTS[locale];
  const base = texts.redeemed(bold(store));
  return withReviewInvite ? `${base}\n\n${escapeHtml(texts.reviewInvite)}` : base;
}

export function rateLabel(locale: NotifyLocale): string {
  return TEXTS[locale].rate;
}
