import { telegramHaptic } from "@/lib/telegram";

type Kind = "success" | "error" | "warning";

let audio: AudioContext | null = null;

/** Call from a user gesture (e.g. tapping "scan") so later beeps are allowed by the browser. */
export function primeAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audio ??= new Ctor();
    void audio.resume();
  } catch {
    /* audio is best-effort */
  }
}

function tone(frequency: number, startAfter: number, duration: number) {
  if (!audio) return;
  const start = audio.currentTime + startAfter;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

const VIBRATION: Record<Kind, number[]> = { success: [40], warning: [60], error: [80, 60, 80] };

/** Cashier feedback: the cashier is busy and rarely looks at the screen, so also use touch and sound. */
export function notify(kind: Kind) {
  telegramHaptic(kind);
  try {
    navigator.vibrate?.(VIBRATION[kind]);
  } catch {
    /* vibration is best-effort */
  }
  if (kind === "success") {
    tone(880, 0, 0.1);
    tone(1320, 0.11, 0.14);
  } else if (kind === "warning") {
    tone(440, 0, 0.18);
  } else {
    tone(220, 0, 0.28);
  }
}
