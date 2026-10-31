/**
 * Where Telegram's native Back button should go from a screen, or null on a role's home screen
 * (wallet, merchant dashboard, cashier), where the system back gesture should close the app.
 */
export type BackTarget = "/merchant" | "/wallet";

export function backTarget(pathname: string, search: Record<string, unknown> = {}): BackTarget | null {
  if (/^\/merchant\/(team|customers|store|program)\/?$/.test(pathname)) return "/merchant";
  if (/^\/merchant\/new\/?$/.test(pathname)) return "/wallet";
  if (pathname.startsWith("/join/")) return "/wallet";
  // A single opened card goes back to the list of cards.
  if (/^\/wallet\/?$/.test(pathname) && search["store"]) return "/wallet";
  return null;
}
