import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { SplashScreen } from "@/components/SplashScreen";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { getMyContext } from "@/lib/store.functions";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Fellogram — Turn loyalty into growth" },
      {
        name: "description",
        content:
          "Fellogram is a Telegram-native loyalty platform: collect stamps, earn rewards, invite friends and help local businesses grow.",
      },
      { property: "og:title", content: "Fellogram — Turn loyalty into growth" },
      {
        property: "og:description",
        content: "Telegram-native loyalty and customer growth for small businesses.",
      },
    ],
  }),
  component: SplashRouter,
});

function SplashRouter() {
  const { state } = useFellogramAuth();
  const navigate = useNavigate();
  const loadContext = useServerFn(getMyContext);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (state === "error") setFailed(true);
    if (state !== "ready") return;

    let cancelled = false;
    (async () => {
      try {
        const context = await loadContext({ data: {} });
        if (cancelled) return;
        if (context.staffStoreId) {
          navigate({ to: "/cashier", replace: true });
        } else if (context.ownedStoreId) {
          navigate({ to: "/merchant", replace: true });
        } else {
          navigate({ to: "/wallet", replace: true });
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-8 text-center">
        <img src="/logo.png" alt={t("app.name")} className="h-20 w-20 object-contain" />
        <p className="text-sm text-muted-foreground">{t("auth.failed")}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          {t("auth.retry")}
        </button>
      </div>
    );
  }

  return <SplashScreen message={state === "loading" ? t("auth.verifying") : t("app.loading")} />;
}
