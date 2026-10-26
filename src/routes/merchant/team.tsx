import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Copy, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/BrandMark";
import { InviteLinkCard } from "@/components/InviteLinkCard";
import { QueryError } from "@/components/QueryError";
import { SplashScreen } from "@/components/SplashScreen";
import { Button } from "@/components/ui/button";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createInvite, getTeam, removeStaff, revokeInvite } from "@/lib/team.functions";

export const Route = createFileRoute("/merchant/team")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Team — Fellogram" },
      { name: "description", content: "Invite cashiers to stamp for your customers." },
      { property: "og:title", content: "Team — Fellogram" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamPage,
});

function friendly(message: string) {
  if (message.includes("TOO_MANY_INVITATIONS")) return t("team.tooMany");
  return t("common.error");
}

function TeamPage() {
  const { state } = useFellogramAuth();
  const queryClient = useQueryClient();
  const load = useServerFn(getTeam);
  const create = useServerFn(createInvite);
  const revoke = useServerFn(revokeInvite);
  const remove = useServerFn(removeStaff);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["team"],
    queryFn: () => load(),
    enabled: state === "ready",
  });

  const [fresh, setFresh] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<string | null>(null);

  // The "tap again" confirmation lapses on its own so a stray tap never removes someone later.
  useEffect(() => {
    if (!confirmUser) return;
    const id = setTimeout(() => setConfirmUser(null), 4000);
    return () => clearTimeout(id);
  }, [confirmUser]);

  const createMutation = useMutation({
    mutationFn: () => create(),
    onSuccess: async (result) => {
      setFresh(result.link);
      await queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: async () => {
      toast.success(t("team.revoked"));
      setFresh(null);
      await queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => remove({ data: { userId } }),
    onSuccess: async () => {
      toast.success(t("team.removed"));
      setConfirmUser(null);
      await queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast.error(friendly(e.message)),
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (state !== "ready" || isLoading || !data) return <SplashScreen />;

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("referral.copied"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <main className="min-h-screen pb-14">
      <AppHeader subtitle={data.storeName} />

      <section className="app-shell">
        <Link to="/merchant" className="touch-action text-sm font-semibold text-primary">
          ← {t("merchant.title")}
        </Link>
        <h1 className="mt-3 text-xl font-bold">{t("team.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("team.subtitle")}</p>

        <Button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="touch-action mt-5 h-14 w-full gap-2 text-base font-bold shadow-[var(--shadow-float)]"
        >
          <UserPlus className="h-5 w-5" />
          {createMutation.isPending ? t("team.inviting") : t("team.invite")}
        </Button>

        {fresh && (
          <div className="mt-4">
            <InviteLinkCard link={fresh} storeName={data.storeName} />
          </div>
        )}

        {data.invitations.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-bold">{t("team.pending")}</h2>
            <ul className="mt-2 space-y-2">
              {data.invitations.map((invite) => (
                <li key={invite.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                  <p className="min-w-0 flex-1 text-xs text-muted-foreground">{t("team.expires", { date: formatDate(invite.expiresAt) })}</p>
                  <Button type="button" variant="outline" size="sm" className="touch-action h-10 gap-1 px-3 text-xs font-semibold" onClick={() => copyLink(invite.link)}>
                    <Copy className="h-3.5 w-3.5" />
                    {t("join.share.copy")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="touch-action h-10 px-3 text-xs font-semibold text-destructive"
                    disabled={revokeMutation.isPending}
                    onClick={() => revokeMutation.mutate(invite.id)}
                  >
                    {t("team.revoke")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-sm font-bold">{t("team.staff")}</h2>
          {data.staff.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-border bg-card p-5 text-center text-sm text-muted-foreground">{t("team.empty")}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {data.staff.map((member) => {
                const label = member.name ?? (member.username ? `@${member.username}` : t("team.cashier"));
                const confirming = confirmUser === member.userId;
                return (
                  <li key={member.userId} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-foreground" aria-hidden="true">
                      {label.replace(/^@/, "").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.username && member.name ? `@${member.username} · ` : ""}
                        {t("team.joined", { date: formatDate(member.joinedAt) })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={confirming ? "destructive" : "ghost"}
                      size="sm"
                      disabled={removeMutation.isPending}
                      className="touch-action h-10 shrink-0 px-3 text-xs font-semibold"
                      onClick={() => (confirming ? removeMutation.mutate(member.userId) : setConfirmUser(member.userId))}
                    >
                      {confirming ? t("team.confirmRemove") : t("team.remove")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
