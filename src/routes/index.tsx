import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { QueryError } from "@/components/QueryError";
import { SplashScreen } from "@/components/SplashScreen";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { toast } from "sonner";

import { acceptReferral, getMyContext } from "@/lib/store.functions";
import { parseStoreCode } from "@/lib/join-code";
import { clearPendingStartParam, readPendingStartParam } from "@/lib/telegram";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const accept = useServerFn(acceptReferral);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    if (state !== "ready") return;

    let cancelled = false;
    (async () => {
      try {
        const pending = readPendingStartParam();
        if (pending?.startsWith("join_")) {
          // Store QR/link: go straight to that store's join screen.
          clearPendingStartParam();
          const storeId = parseStoreCode(pending);
          if (storeId) {
            navigate({ to: "/join/$storeId", params: { storeId }, replace: true });
            return;
          }
        }
        if (pending?.startsWith("ref_")) {
          clearPendingStartParam();
          const res = await accept({ data: { param: pending } }).catch(() => ({ status: "invalid" as const }));
          if (cancelled) return;
          const messages = {
            pending: t("referral.welcome"),
            self: t("referral.self"),
            already_member: t("referral.already"),
            disabled: t("referral.disabled"),
            invalid: t("referral.invalid"),
          } as const;
          if (res.status === "pending") toast.success(messages.pending);
          else toast.message(messages[res.status]);
          // Referred customers land on their new card.
          navigate({ to: "/wallet", replace: true });
          return;
        }
        const context = await loadContext();
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
        if (cancelled) return;
        // Retry quietly a couple of times (cold starts), then say what is wrong instead of spinning forever.
        if (attempt < 2) setTimeout(() => setAttempt((n) => n + 1), 1500);
        else setFailure(error);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, attempt]);

  if (failure) {
    return (
      <QueryError
        error={failure}
        onRetry={() => {
          setFailure(null);
          setAttempt(0);
        }}
      />
    );
  }

  return <SplashScreen />;
}
