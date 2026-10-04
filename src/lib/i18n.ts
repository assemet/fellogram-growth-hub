/**
 * Minimal i18n layer. All UI copy goes through `t()` so business logic never
 * carries hardcoded strings. Arabic (and other locales) can be added by
 * dropping another dictionary into `dictionaries`.
 */

export type Locale = "en";

const en = {
  "app.name": "Fellogram",
  "app.tagline": "Turn loyalty into growth",
  "app.loading": "Preparing your wallet…",

  "auth.verifying": "Verifying your Telegram account…",
  "auth.failed": "We couldn't verify your Telegram session.",
  "auth.retry": "Try again",

  "wallet.title": "My Loyalty",
  "wallet.empty.title": "No loyalty cards yet",
  "wallet.empty.body": "Scan a store's join QR to start collecting stamps.",
  "wallet.merchantCta.title": "Own a business?",
  "wallet.merchantCta.action": "Create your Store",

  "onboarding.step": "Step {current} of {total}",
  "onboarding.store.title": "Your store",
  "onboarding.store.subtitle": "What should customers see?",
  "onboarding.store.name": "Store name",
  "onboarding.store.namePlaceholder": "ABC Coffee",
  "onboarding.store.description": "Short description (optional)",
  "onboarding.program.title": "Loyalty program",
  "onboarding.program.subtitle": "Stamps only — simple and fast.",
  "onboarding.program.name": "Program name",
  "onboarding.program.namePlaceholder": "Coffee Club",
  "onboarding.program.stamps": "Stamps required for a reward",
  "onboarding.program.reward": "Reward",
  "onboarding.program.rewardPlaceholder": "Free Coffee",
  "onboarding.done.title": "Your store is live",
  "onboarding.done.body": "You can now add rewards, invite staff and start stamping.",
  "onboarding.next": "Continue",
  "onboarding.back": "Back",
  "onboarding.create": "Create store",
  "onboarding.creating": "Creating…",
  "onboarding.goToDashboard": "Go to dashboard",
  "onboarding.preview": "Visit {count} times → {reward}",

  "merchant.title": "Store dashboard",
  "merchant.program": "Loyalty program",
  "merchant.stamps": "{count} stamps → {reward}",
  "merchant.metrics.customers": "Customers",
  "merchant.metrics.visits": "Visits",
  "merchant.metrics.rewards": "Rewards",
  "merchant.metrics.referrals": "Referral customers",
  "merchant.soon": "Coming next",
  "merchant.soon.body": "Customer stamps, cashier mode, rewards and referral growth arrive in the next slices.",
  "merchant.switchToWallet": "My loyalty wallet",

  "wallet.card.stamps": "{balance} of {required} stamps",
  "wallet.card.reward": "Reward: {reward}",
  "wallet.card.ready": "Reward ready! Show this card at the counter.",
  "wallet.card.toGo": "{count} more visits to your reward",
  "wallet.card.lastVisit": "Last visit {date}",
  "wallet.card.history": "Recent visits",
  "wallet.card.noHistory": "No visits recorded yet.",
  "wallet.card.hide": "Hide",

  "join.title": "Join loyalty card",
  "join.subtitle": "Collect stamps on every visit and unlock your reward.",
  "join.action": "Join this loyalty card",
  "join.joining": "Joining…",
  "join.already": "You're already collecting stamps here.",
  "join.success": "Loyalty card added!",
  "join.notFound": "This store's loyalty card is not available.",
  "join.viewWallet": "Open my wallet",

  "program.title": "Loyalty program",
  "program.subtitle": "Set how many stamps a reward takes.",
  "program.name": "Program name",
  "program.stamps": "Stamps required",
  "program.reward": "Reward",
  "program.rewardDescription": "Reward details (optional)",
  "program.save": "Save program",
  "program.saving": "Saving…",
  "program.saved": "Loyalty program updated.",
  "program.edit": "Edit program",
  "program.preview": "{count} stamps → {reward}",

  "qr.title": "Your customer QR",
  "qr.subtitle": "Show this at the counter to collect a stamp.",

  "cashier.title": "Cashier mode",
  "cashier.soon": "Scanning arrives in the next slice.",
  "cashier.denied": "Cashier mode is for store staff only.",
  "cashier.scan": "Scan customer QR",
  "cashier.scanning": "Point the camera at the customer's QR",
  "cashier.stop": "Stop camera",
  "cashier.manual": "Or enter customer code",
  "cashier.manualPlaceholder": "Customer code",
  "cashier.find": "Find customer",
  "cashier.searching": "Searching…",
  "cashier.award": "Award stamp",
  "cashier.awarding": "Stamping…",
  "cashier.awarded": "Stamp added!",
  "cashier.undo": "Undo last stamp",
  "cashier.undoing": "Undoing…",
  "cashier.undone": "Last stamp reversed.",
  "cashier.reset": "Next customer",
  "cashier.balance": "{balance} of {required} stamps",
  "cashier.rewardReady": "Reward ready for this customer.",
  "cashier.cooldown": "Already stamped — try again in {count} min.",
  "cashier.notMember": "This customer hasn't joined your loyalty card yet.",
  "cashier.invalidCode": "That code isn't a valid customer QR.",
  "cashier.nothingToUndo": "No recent stamp to undo.",
  "cashier.cameraError": "Camera unavailable. Enter the code manually.",
  "common.error": "Something went wrong.",
  "rewards.title": "Rewards",
  "rewards.available": "Ready to redeem",
  "rewards.locked": "{count} more stamps",
  "rewards.redeem": "Redeem reward",
  "rewards.generating": "Preparing…",
  "rewards.showCashier": "Show this QR to the cashier",
  "rewards.expiresIn": "Expires in {time}",
  "rewards.expired": "This code expired. Generate a new one.",
  "rewards.again": "New code",
  "rewards.close": "Close",
  "rewards.manage": "Rewards",
  "rewards.manageSub": "Offer several rewards at different stamp levels.",
  "rewards.add": "Add reward",
  "rewards.save": "Save reward",
  "rewards.remove": "Remove",
  "rewards.stamps": "Stamps",
  "rewards.name": "Reward name",
  "rewards.description": "Description (optional)",
  "rewards.notEnough": "Not enough stamps yet.",
  "cashier.scanReward": "Scan reward QR",
  "cashier.rewardManual": "Or enter reward code",
  "cashier.redeem": "Redeem",
  "cashier.redeemed": "Reward redeemed: {reward} (−{count} stamps)",
  "cashier.tokenInvalid": "That reward code isn't valid for this store.",
  "cashier.tokenUsed": "This reward code was already used.",
  "cashier.tokenExpired": "This reward code expired. Ask the customer for a new one.",
} satisfies Record<string, string>;

export type TranslationKey = keyof typeof en;

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en };

let locale: Locale = "en";

export function setLocale(next: Locale) {
  locale = next;
}

export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[locale][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
