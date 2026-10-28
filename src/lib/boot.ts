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
