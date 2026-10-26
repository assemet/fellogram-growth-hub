import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/BrandMark";
import { QueryError } from "@/components/QueryError";
import { SplashScreen } from "@/components/SplashScreen";
import { Button } from "@/components/ui/button";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t } from "@/lib/i18n";
import { deleteStore, getMyStore, updateStoreProfile } from "@/lib/store.functions";

export const Route = createFileRoute("/merchant/store")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Store settings — Fellogram" },
      { name: "description", content: "Rename or delete your store." },
      { property: "og:title", content: "Store settings — Fellogram" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoreSettingsPage,
});

function StoreSettingsPage() {
  const { state } = useFellogramAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const loadStore = useServerFn(getMyStore);
  const saveProfile = useServerFn(updateStoreProfile);
  const removeStore = useServerFn(deleteStore);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-store"],
    queryFn: () => loadStore(),
    enabled: state === "ready",
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [confirmName, setConfirmName] = useState("");

  // Fill the form once the store loads; a background refresh must not wipe what is being typed.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!data || hydratedFor === data.store.id) return;
    setName(data.store.name);
    setDescription(data.store.description ?? "");
    setHydratedFor(data.store.id);
  }, [data, hydratedFor]);

  const saveMutation = useMutation({
    mutationFn: () => saveProfile({ data: { name, description } }),
    onSuccess: async () => {
      toast.success(t("store.saved"));
      await queryClient.invalidateQueries({ queryKey: ["my-store"] });
      await queryClient.invalidateQueries({ queryKey: ["my-cards"] });
      await queryClient.invalidateQueries({ queryKey: ["store-join-link"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("INVALID_NAME") ? t("store.nameInvalid") : t("common.error")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeStore({ data: { confirmName } }),
    onSuccess: () => {
      toast.success(t("store.deleted"));
      // Everything cached belongs to the deleted store, so start clean and let the app re-route.
      queryClient.clear();
      navigate({ to: "/", replace: true });
    },
    onError: (e: Error) => toast.error(e.message.includes("CONFIRM_MISMATCH") ? t("store.deleteMismatch") : t("common.error")),
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (state !== "ready" || isLoading || !data) return <SplashScreen />;

  const trimmed = name.trim().replace(/\s+/g, " ");
  const nameValid = trimmed.length >= 2 && trimmed.length <= 60;
  const dirty = trimmed !== data.store.name || description.trim() !== (data.store.description ?? "");
  const confirmed = confirmName.trim().toLowerCase() === data.store.name.trim().toLowerCase();

  return (
    <main className="min-h-screen pb-14">
      <AppHeader subtitle={data.store.name} />

      <section className="app-shell">
        <Link to="/merchant" className="touch-action text-sm font-semibold text-primary">
          ← {t("merchant.title")}
        </Link>
        <h1 className="mt-3 text-xl font-bold">{t("store.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("store.subtitle")}</p>

        <form
          className="mt-5 space-y-4 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!nameValid) {
              toast.error(t("store.nameInvalid"));
              return;
            }
            saveMutation.mutate();
          }}
        >
          <div>
            <label htmlFor="storeName" className="text-sm font-semibold">
              {t("store.name")}
            </label>
            <input
              id="storeName"
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="storeDescription" className="text-sm font-semibold">
              {t("store.description")}
            </label>
            <textarea
              id="storeDescription"
              value={description}
              maxLength={160}
              rows={2}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button type="submit" disabled={!dirty || !nameValid || saveMutation.isPending} className="touch-action h-12 w-full font-bold">
            {saveMutation.isPending ? t("program.saving") : t("store.save")}
          </Button>
        </form>

        <div className="mt-8 rounded-lg border border-destructive/40 bg-destructive/5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-destructive">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t("store.danger.title")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("store.danger.body", { name: data.store.name, customers: data.customerCount })}
          </p>
          <label htmlFor="confirmName" className="mt-4 block text-xs font-semibold text-muted-foreground">
            {t("store.danger.confirmLabel")}
          </label>
          <input
            id="confirmName"
            value={confirmName}
            onChange={(event) => setConfirmName(event.target.value)}
            placeholder={data.store.name}
            autoComplete="off"
            className="mt-2 w-full rounded-md border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-destructive"
          />
          <Button
            type="button"
            variant="destructive"
            disabled={!confirmed || deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
            className="touch-action mt-4 h-12 w-full font-bold"
          >
            {deleteMutation.isPending ? t("store.danger.deleting") : t("store.danger.action")}
          </Button>
        </div>
      </section>
    </main>
  );
}
