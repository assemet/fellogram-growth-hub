import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AppHeader } from "@/components/BrandMark";
import { BackLink } from "@/components/BackLink";
import { QueryError } from "@/components/QueryError";
import { SettingsCard } from "@/components/SettingsCard";
import { SplashScreen } from "@/components/SplashScreen";
import { Button } from "@/components/ui/button";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { ExistingTrialCard, PlansCard, ReferralsCard, SettingsPanel, StarsCard, StorePlan } from "@/components/admin/BillingPanels";
import { adminBilling, adminOverview, adminSetStoreActive, type AdminBilling, type AdminStore } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Fellogram" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

/** Platform owner page. Deliberately not translated: only the owner ever sees it. */
const dateFormat = new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" });

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString("en")}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function StoreRow({ store, busy, onToggle, billing }: { store: AdminStore; busy: boolean; onToggle: (active: boolean) => void; billing: AdminBilling | undefined }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {store.name}
          {!store.active && <span className="ms-2 rounded bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground">موقوف</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">{store.owner}</p>
        <p className="text-xs text-muted-foreground">
          {store.customers.toLocaleString("en")} عميل · {dateFormat.format(new Date(store.createdAt))}
        </p>
        {store.active ? (
          <Link to="/join/$storeId" params={{ storeId: store.id }} className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold underline underline-offset-4">
            عرض صفحة المتجر وبطاقته
          </Link>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">الصفحة لا تُفتح وهو موقوف، فعّله مؤقتاً لمعاينتها.</p>
        )}
        {billing && <StorePlan storeId={store.id} billing={billing} current={billing.current.find((c) => c.storeId === store.id)} />}
      </div>
      {store.active ? (
        confirming ? (
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="destructive" disabled={busy} className="h-11" onClick={() => { setConfirming(false); onToggle(false); }}>
              تأكيد الإيقاف
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={() => setConfirming(false)}>
              إلغاء
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" disabled={busy} className="h-11 shrink-0" onClick={() => setConfirming(true)}>
            إيقاف
          </Button>
        )
      ) : (
        <Button type="button" disabled={busy} className="h-11 shrink-0" onClick={() => onToggle(true)}>
          تفعيل
        </Button>
      )}
    </li>
  );
}

function AdminPage() {
  const { state } = useFellogramAuth();
  const load = useServerFn(adminOverview);
  const setActive = useServerFn(adminSetStoreActive);
  const queryClient = useQueryClient();
  const { data, error, refetch } = useQuery({ queryKey: ["admin-overview"], queryFn: () => load(), enabled: state === "ready", retry: false });
  const loadBilling = useServerFn(adminBilling);
  const billingQuery = useQuery({ queryKey: ["admin-billing"], queryFn: () => loadBilling(), enabled: state === "ready" && !error, retry: false });
  const billing = billingQuery.data;
  const toggle = useMutation({
    mutationFn: (input: { storeId: string; active: boolean }) => setActive({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
  });

  if (error) {
    // Anyone who is not the owner gets the same answer as for a page that does not exist.
    if (String((error as { message?: unknown }).message ?? "").includes("NOT_FOUND")) {
      return (
        <main className="min-h-[100dvh]">
          <AppHeader />
          <section className="app-shell">
            <p className="py-16 text-center text-sm text-muted-foreground">404</p>
          </section>
        </main>
      );
    }
    return <QueryError error={error} onRetry={() => refetch()} />;
  }
  if (state !== "ready" || !data) return <SplashScreen />;

  const { totals } = data;
  return (
    <main className="min-h-screen pb-14">
      <AppHeader />
      <section className="app-shell space-y-4">
        <BackLink to="/settings">الإعدادات</BackLink>
        <SettingsCard title="نظرة عامة" description="للقراءة فقط، من قاعدة البيانات مباشرة.">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="المتاجر" value={totals.stores} />
            <Stat label="المتاجر الفعّالة" value={totals.activeStores} />
            <Stat label="المستخدمون" value={totals.users} />
            <Stat label="البطاقات" value={totals.cards} />
            <Stat label="زاروا آخر 7 أيام" value={totals.visitedLast7Days} />
            <Stat label="مستخدمون جدد (7 أيام)" value={totals.newUsersLast7Days} />
            <Stat label="متاجر جديدة (7 أيام)" value={totals.newStoresLast7Days} />
          </div>
        </SettingsCard>

        {billingQuery.isError && (
          <SettingsCard title="الباقات" description="تعذّر تحميل الباقات. إن لم تُنفّذ ملف SQL الخاص بـ part96 في Supabase فنفّذه أولاً.">
            <p dir="ltr" className="text-xs text-muted-foreground">{String((billingQuery.error as Error).message)}</p>
          </SettingsCard>
        )}
        {billing && <PlansCard billing={billing} onSaved={() => void billingQuery.refetch()} />}
        {billing && <SettingsPanel key={JSON.stringify(billing.settings)} settings={billing.settings} plans={billing.plans} onSaved={() => void billingQuery.refetch()} />}
        {billing && <ExistingTrialCard settings={billing.settings} />}
        {billing && <ReferralsCard />}
        {billing && <StarsCard />}

        <SettingsCard title="أحدث المتاجر" description="الإيقاف يخفي المتجر عن العملاء، ويبقى مرئياً لصاحبه.">
          {toggle.isError && <p role="alert" className="text-sm text-destructive">تعذّر التنفيذ: {String((toggle.error as Error).message)}</p>}
          <ul className="-my-3 divide-y divide-border">
            {data.stores.map((store) => (
              <StoreRow
                key={store.id}
                store={store}
                busy={toggle.isPending}
                billing={billing}
                onToggle={(active) => toggle.mutate({ storeId: store.id, active })}
              />
            ))}
            {data.stores.length === 0 && <li className="py-3 text-sm text-muted-foreground">لا توجد متاجر بعد.</li>}
          </ul>
        </SettingsCard>

        <SettingsCard title="أحدث المستخدمين">
          <ul className="-my-3 divide-y divide-border">
            {data.users.map((user) => (
              <li key={user.id} className="py-3">
                <p className="text-sm font-semibold">
                  {user.name}
                  {user.username && <span dir="ltr" className="ms-2 text-xs font-normal text-muted-foreground">@{user.username}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.language ?? "—"} · {dateFormat.format(new Date(user.createdAt))}
                </p>
              </li>
            ))}
          </ul>
        </SettingsCard>
      </section>
    </main>
  );
}
