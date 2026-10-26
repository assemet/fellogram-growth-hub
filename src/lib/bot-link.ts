/**
 * Deep links into the Mini App, built in one place.
 *
 * - TELEGRAM_BOT_USERNAME: the bot's username without "@" (default: fellogram_bot).
 * - TELEGRAM_MINIAPP_SHORTNAME: the Mini App's short name from BotFather (default: fello).
 *   Set it to "main" if the app is the bot's *main* Mini App, which uses
 *   https://t.me/<bot>?startapp=... without a short name (an empty value also works).
 */
const DEFAULT_BOT = "fellogram_bot";
const DEFAULT_MINIAPP = "fello";

export function botUsername(): string {
  const raw = process.env["TELEGRAM_BOT_USERNAME"] ?? process.env["VITE_TELEGRAM_BOT_USERNAME"] ?? DEFAULT_BOT;
  return raw.replace(/^@/, "").trim() || DEFAULT_BOT;
}

export function miniAppLink(startParam: string): string {
  const configured = (process.env["TELEGRAM_MINIAPP_SHORTNAME"] ?? DEFAULT_MINIAPP).trim();
  const shortName = configured.toLowerCase() === "main" ? "" : configured;
  const base = shortName ? `https://t.me/${botUsername()}/${shortName}` : `https://t.me/${botUsername()}`;
  return `${base}?startapp=${startParam}`;
}
