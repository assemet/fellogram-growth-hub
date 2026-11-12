import { useId } from "react";

import { t } from "@/lib/i18n";

/**
 * A satin gift ribbon with a bow, tied across the top corner of a card to say "there is an offer here".
 * Drawn as vector art (no image file). Sits on the end corner, so it mirrors in right-to-left languages.
 * The parent must be `relative` and clip its corners (`overflow-hidden`).
 */
export function GiftRibbon({ className = "w-24" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={t("promo.badge.offer")}
      className={`pointer-events-none absolute end-0 top-0 z-10 h-auto drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)] rtl:-scale-x-100 ${className}`}
    >
      <defs>
        <linearGradient id={`band${id}`} gradientUnits="userSpaceOnUse" x1="60" y1="-2" x2="60" y2="22">
          <stop offset="0" stopColor="#a50f1c" />
          <stop offset="0.3" stopColor="#f2424d" />
          <stop offset="0.55" stopColor="#d51a28" />
          <stop offset="1" stopColor="#8d0b17" />
        </linearGradient>
        <radialGradient id={`loop${id}`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#ff6a72" />
          <stop offset="0.55" stopColor="#d51a28" />
          <stop offset="1" stopColor="#8d0b17" />
        </radialGradient>
      </defs>
      {/* the band across the corner */}
      <polygon points="38,0 62,0 100,38 100,62" fill={`url(#band${id})`} />
      <polygon points="38,0 62,0 100,38 100,62" fill="none" stroke="#7a0914" strokeOpacity="0.35" strokeWidth="0.8" />
      {/* tails */}
      <path d="M65,20 L54,46 L61,42 L65,48 L71,23 Z" fill="#b8121f" stroke="#7a0914" strokeOpacity="0.5" strokeWidth="0.7" />
      <path d="M69,21 L82,42 L76,40 L75,47 L66,23 Z" fill="#c9161f" stroke="#7a0914" strokeOpacity="0.5" strokeWidth="0.7" />
      {/* loops */}
      <path d="M68,18 C52,1 38,12 49,25 C56,31 64,25 68,18 Z" fill={`url(#loop${id})`} stroke="#7a0914" strokeOpacity="0.5" strokeWidth="0.7" />
      <path d="M68,18 C84,1 98,12 87,25 C80,31 72,25 68,18 Z" fill={`url(#loop${id})`} stroke="#7a0914" strokeOpacity="0.5" strokeWidth="0.7" />
      <path d="M60,14 C55,12 52,16 55,20" fill="none" stroke="#ffb3b8" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M77,13 C82,11 85,15 82,19" fill="none" stroke="#ffb3b8" strokeOpacity="0.6" strokeWidth="1.4" strokeLinecap="round" />
      {/* knot */}
      <ellipse cx="68" cy="18" rx="5.5" ry="5" fill="#c9161f" stroke="#7a0914" strokeOpacity="0.6" strokeWidth="0.8" />
      <ellipse cx="66.5" cy="16.5" rx="2" ry="1.4" fill="#ff8c93" fillOpacity="0.8" />
    </svg>
  );
}
