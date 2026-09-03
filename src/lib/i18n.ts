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

  "cashier.title": "Cashier mode",
  "cashier.soon": "Scanning arrives in the next slice.",
  "common.error": "Something went wrong.",
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
