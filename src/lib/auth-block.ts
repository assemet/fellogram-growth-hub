/**
 * Set when the server refuses to sign this visitor in because the app was not opened from Telegram.
 * One overlay (see TelegramRequired) listens to it, so every screen shows the same message.
 */
let blocked = false;
const listeners = new Set<() => void>();

export function isAuthBlocked(): boolean {
  return blocked;
}

export function setAuthBlocked(value: boolean): void {
  if (blocked === value) return;
  blocked = value;
  listeners.forEach((listener) => listener());
}

export function subscribeAuthBlocked(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
