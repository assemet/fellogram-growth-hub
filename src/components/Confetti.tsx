import { useMemo } from "react";

const COLORS = ["#f5b82e", "#16a34a", "#2563eb", "#e11d48", "#8b5cf6", "#f97316"];

function reducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * A short burst of confetti falling from the top. `fixed` covers the whole screen; otherwise it fills the nearest
 * positioned parent (use `fall` for that parent's height in px). Never blocks taps and draws nothing when the device
 * asks for reduced motion.
 */
export function Confetti({ fixed = false, fall = 700, count = 44 }: { fixed?: boolean; fall?: number; count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        duration: 1.9 + Math.random() * 1.5,
        size: 6 + Math.random() * 7,
        drift: Math.round((Math.random() - 0.5) * 140),
        spin: Math.round(360 + Math.random() * 540) * (Math.random() < 0.5 ? -1 : 1),
        color: COLORS[i % COLORS.length]!,
        round: Math.random() < 0.3,
      })),
    [count],
  );
  if (reducedMotion()) return null;
  return (
    <div className={`pointer-events-none ${fixed ? "fixed inset-0 z-[60]" : "absolute inset-0 z-10"} overflow-hidden`} aria-hidden="true">
      {pieces.map((piece, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 0.45,
            borderRadius: piece.round ? "9999px" : "2px",
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            ["--fall" as string]: `${fixed ? (typeof window === "undefined" ? 800 : window.innerHeight + 40) : fall}px`,
            ["--drift" as string]: `${piece.drift}px`,
            ["--spin" as string]: `${piece.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
