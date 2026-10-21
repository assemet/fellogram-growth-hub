import { useEffect, useRef } from "react";

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
  const entrance = useRef(!entrancePlayed);
  useEffect(() => {
    entrancePlayed = true;
  }, []);

  const phase = typeof performance === "undefined" ? 0 : Math.round(performance.now() % CYCLE_MS);

  return (
    <div className="splash-bg flex min-h-[100dvh] flex-col items-center justify-center px-8 text-center">
      <div className={`flex flex-col items-center ${entrance.current ? "animate-splash" : ""}`}>
        <div className="splash-tile">
          <img src="/logo-mark.png" alt="" width={92} height={92} />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">{t("app.name")}</h1>
        <p className="mt-1 text-sm font-medium opacity-85">{t("app.tagline")}</p>
      </div>

      <div
        className="splash-dots mt-10"
        style={{ ["--phase" as string]: `${phase}ms` }}
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((index) => (
          <span key={index} className="splash-dot" style={{ ["--i" as string]: index }} />
        ))}
      </div>

      <p role="status" aria-live="polite" className="mt-5 text-xs font-medium opacity-80">
        {message ?? t("app.loading")}
      </p>
    </div>
  );
}
