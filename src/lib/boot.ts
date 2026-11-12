/**
 * The branded splash belongs to app start only. Once the first real screen has appeared, moving
 * between screens must feel instant, so later loading states use a light skeleton instead.
 */
let booted = false;

export function hasBooted(): boolean {
  return booted;
}

export function markBooted(): void {
  booted = true;
}

// ---- Splash presence ----
// Screens that are still loading before the first real screen register here. One splash overlay lives above the
// whole app (see BootSplash) and stays up while any of them is mounted, so moving between loading screens never
// tears the splash down and rebuilds it (which showed up as a blink).
let pendingScreens = 0;
const splashListeners = new Set<() => void>();

export function registerSplash(): () => void {
  pendingScreens += 1;
  splashListeners.forEach((listener) => listener());
  return () => {
    pendingScreens -= 1;
    splashListeners.forEach((listener) => listener());
  };
}

export function splashPending(): boolean {
  return pendingScreens > 0;
}

export function subscribeSplash(listener: () => void): () => void {
  splashListeners.add(listener);
  return () => {
    splashListeners.delete(listener);
  };
}
