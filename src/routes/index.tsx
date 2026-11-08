import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { QueryError } from "@/components/QueryError";
import { SplashScreen } from "@/components/SplashScreen";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { toast } from "sonner";

import { acceptReferral, getMyContext } from "@/lib/store.functions";
import { acceptInvite } from "@/lib/team.functions";
import { parseStoreCode } from "@/lib/join-code";
import { acceptWithRetry, referralLanding } from "@/lib/referral-landing";
import { pickStartTab, readLastTab, TAB_PATH } from "@/lib/start-tab";
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
  const acceptStaff = useServerFn(acceptInvite);
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
        if (pending?.startsWith("staff_")) {
          // Cashier invitation from the owner: join the team, then go straight to cashier mode.
          clearPendingStartParam();
          try {
            await acceptStaff({ data: { token: pending.slice("staff_".length) } });
            if (cancelled) return;
            toast.success(t("team.accepted"));
            navigate({ to: "/cashier", replace: true });
            return;
          } catch (inviteError) {
            const message = String((inviteError as Error)?.message ?? "");
            toast.error(
              message.includes("INVITE_USED")
                ? t("team.used")
                : message.includes("INVITE_EXPIRED")
                  ? t("team.expired")
                  : t("team.invalid"),
            );
            // fall through to normal routing
          }
        }
        if (pending?.startsWith("ref_")) {
          // The invitation stays saved until the server has answered for good, so a slow first launch cannot lose it.
          const res = await acceptWithRetry(() => accept({ data: { param: pending } }), (ms) => new Promise((resolve) => setTimeout(resolve, ms)));
          if (cancelled) return;
          if (!res) throw new Error("REFERRAL_UNREACHABLE");
          clearPendingStartParam();
          const messages = {
            pending: t("referral.welcome"),
            self: t("referral.self"),
            already_member: t("referral.already"),
            disabled: t("referral.disabled"),
            invalid: t("referral.invalid"),
          } as const;
          if (res.status === "pending") toast.success(messages.pending);
          else toast.message(messages[res.status]);
          // The friend lands on the store that invited them (their new card), not on the generic wallet.
          const landing = referralLanding(res);
          if (landing.to === "join") navigate({ to: "/join/$storeId", params: { storeId: landing.storeId }, replace: true });
          else if (landing.storeId) navigate({ to: "/wallet", search: { store: landing.storeId }, replace: true });
          else navigate({ to: "/wallet", replace: true });
          return;
        }
        const context = await loadContext();
        if (cancelled) return;
        // Reopen the tab used last (if still allowed), otherwise the one that fits the role.
        const tab = pickStartTab({ isOwner: Boolean(context.ownedStoreId), isStaff: Boolean(context.staffStoreId) }, readLastTab());
        navigate({ to: TAB_PATH[tab], replace: true });
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
