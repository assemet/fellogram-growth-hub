import { useEffect, useRef, useState } from "react";

import { PageSkeleton } from "@/components/PageSkeleton";
import { hasBooted } from "@/lib/boot";
import { t } from "@/lib/i18n";

const CYCLE_MS = 2400;

/** True once any splash has played its entrance, so later mounts do not replay it. */
let entrancePlayed = false;

/**
 * One continuous splash: every route shows this while it loads. The entrance only
 * plays on the first mount and the stamp dots keep their phase across mounts, so
 * moving from route to route looks like a single splash instead of several.
 */
export function SplashScreen({ message }: { message?: string }) {
  // No hooks here on purpose: the choice may flip between renders once the first screen has appeared.
  return hasBooted() ? <PageSkeleton /> : <BrandedSplash message={message} />;
}

// Fixed positions: the splash must look the same on every mount, so nothing here is random.
const SPARKS = [
  { x: "12%", y: "14%", s: "0.9rem", d: "0ms" },
  { x: "82%", y: "10%", s: "0.65rem", d: "900ms", gold: true },
  { x: "70%", y: "24%", s: "1.1rem", d: "1700ms" },
  { x: "22%", y: "34%", s: "0.6rem", d: "2300ms", gold: true },
  { x: "90%", y: "46%", s: "0.8rem", d: "400ms" },
  { x: "8%", y: "56%", s: "1rem", d: "1300ms" },
  { x: "76%", y: "68%", s: "0.7rem", d: "2000ms", gold: true },
  { x: "30%", y: "78%", s: "0.9rem", d: "700ms" },
  { x: "58%", y: "88%", s: "0.6rem", d: "1900ms", gold: true },
  { x: "88%", y: "86%", s: "1rem", d: "1100ms" },
  { x: "14%", y: "90%", s: "0.65rem", d: "2600ms" },
  { x: "46%", y: "6%", s: "0.6rem", d: "1500ms", gold: true },
];
const BURST = Array.from({ length: 8 }, (_, index) => ({ angle: index * 45 + 22, radius: index % 2 ? 128 : 158 }));

function BrandedSplash({ message }: { message?: string | undefined }) {
  const entrance = useRef(!entrancePlayed);
  // The entrance starts only once the logo is decoded: a half-loaded image looked blurry and jumpy.
  const [logoReady, setLogoReady] = useState(!entrance.current);
  useEffect(() => {
    entrancePlayed = true;
    if (logoReady) return;
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        setLogoReady(true);
      }
    };
    const image = new Image();
    image.src = "/logo-mascot.png";
    image.decode().then(finish, finish);
    const timer = window.setTimeout(finish, 1500); // never hold the splash for a slow network
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phase = typeof performance === "undefined" ? 0 : Math.round(performance.now() % CYCLE_MS);

  return (
    <div className={`splash-bg flex min-h-[100dvh] flex-col items-center justify-center px-8 text-center ${entrance.current ? (logoReady ? "splash-play" : "splash-wait") : ""}`}>
      <div className="splash-sparkles" aria-hidden="true">
        {SPARKS.map((spark, index) => (
          <span
            key={index}
            className={`splash-spark ${spark.gold ? "is-gold" : ""}`}
            style={{ ["--x" as string]: spark.x, ["--y" as string]: spark.y, ["--s" as string]: spark.s, ["--d" as string]: spark.d }}
          />
        ))}
      </div>

      <div className="splash-stage" aria-hidden="true">
        <div className="splash-glow" />
        <div className="splash-ring" />
        <div className="splash-ring" />
        {BURST.map((star, index) => (
          <span
            key={star.angle}
            className="splash-burst"
            style={{ ["--a" as string]: `${star.angle}deg`, ["--r" as string]: `${star.radius}px`, ["--i" as string]: index }}
          />
        ))}
        <div className="splash-logo-wrap">
          <div className="splash-float">
            <img className="splash-logo" src="/logo-mascot.png" alt="" width={440} height={476} fetchPriority="high" decoding="async" />
          </div>
        </div>
      </div>

      <div className="splash-copy">
        <h1 className="sr-only">{t("app.name")}</h1>
        <p className="mt-2 text-base font-semibold tracking-tight text-white/95">{t("app.tagline")}</p>

        <div
          className="splash-dots mt-8 justify-center"
          style={{ ["--phase" as string]: `${phase}ms` }}
          aria-hidden="true"
        >
          {[0, 1, 2, 3, 4].map((index) => (
            <span key={index} className="splash-dot" style={{ ["--i" as string]: index }} />
          ))}
        </div>

        <p role="status" aria-live="polite" className="mt-5 text-xs font-medium text-white/80">
          {message ?? t("app.loading")}
        </p>
      </div>
    </div>
  );
}
