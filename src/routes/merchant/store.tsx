import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/BrandMark";
import { BackLink } from "@/components/BackLink";
import { QueryError } from "@/components/QueryError";
import { StoreLogoSettings } from "@/components/StoreLogoSettings";
import { SplashScreen } from "@/components/SplashScreen";
import { Button } from "@/components/ui/button";
import { useFellogramAuth } from "@/hooks/useFellogramAuth";
import { t, type TranslationKey } from "@/lib/i18n";
import { deleteStore, getMyStore, updateStoreProfile } from "@/lib/store.functions";
import { CONTACT_FIELDS, contactFromRow, normalizeContact, type ContactField } from "@/lib/store-contact";

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

type ContactInputDef = {
  field: ContactField;
  label: TranslationKey;
  placeholder: TranslationKey;
  hint?: TranslationKey;
  error: TranslationKey;
  inputMode: "tel" | "url" | "text";
  /** Phone numbers, handles and links read left-to-right even inside an Arabic screen. */
  ltr: boolean;
  maxLength: number;
};

const CONTACT_INPUTS: ContactInputDef[] = [
  { field: "phone", label: "store.contact.phone", placeholder: "store.contact.phone.ph", error: "contact.error.phone", inputMode: "tel", ltr: true, maxLength: 24 },
  { field: "whatsapp", label: "store.contact.whatsapp", placeholder: "store.contact.phone.ph", hint: "store.contact.whatsapp.hint", error: "contact.error.whatsapp", inputMode: "tel", ltr: true, maxLength: 24 },
  { field: "address", label: "store.contact.address", placeholder: "store.contact.address.ph", error: "contact.error.address", inputMode: "text", ltr: false, maxLength: 200 },
];
const LINK_INPUTS: ContactInputDef[] = [
  { field: "telegram", label: "store.contact.telegram", placeholder: "store.contact.telegram.ph", error: "contact.error.telegram", inputMode: "text", ltr: true, maxLength: 120 },
  { field: "instagram", label: "store.contact.instagram", placeholder: "store.contact.instagram.ph", error: "contact.error.instagram", inputMode: "text", ltr: true, maxLength: 200 },
  { field: "facebook", label: "store.contact.facebook", placeholder: "store.contact.facebook.ph", error: "contact.error.facebook", inputMode: "url", ltr: true, maxLength: 300 },
  { field: "tiktok", label: "store.contact.tiktok", placeholder: "store.contact.tiktok.ph", error: "contact.error.tiktok", inputMode: "text", ltr: true, maxLength: 200 },
  { field: "website", label: "store.contact.website", placeholder: "store.contact.website.ph", error: "contact.error.website", inputMode: "url", ltr: true, maxLength: 300 },
  { field: "maps", label: "store.contact.maps", placeholder: "store.contact.maps.ph", error: "contact.error.maps", inputMode: "url", ltr: true, maxLength: 300 },
];

const emptyContact = (): Record<ContactField, string> => Object.fromEntries(CONTACT_FIELDS.map((field) => [field, ""])) as Record<ContactField, string>;

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
  const [contact, setContact] = useState<Record<ContactField, string>>(emptyContact);
  // An error shows once a field has been left, or after a failed save, not while the first characters are typed.
  const [touched, setTouched] = useState<Partial<Record<ContactField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  // Fill the form once the store loads; a background refresh must not wipe what is being typed.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  useEffect(() => {
    if (!data || hydratedFor === data.store.id) return;
    setName(data.store.name);
    setDescription(data.store.description ?? "");
    const stored = contactFromRow(data.store as unknown as Record<string, unknown>);
    setContact(Object.fromEntries(CONTACT_FIELDS.map((field) => [field, stored[field] ?? ""])) as Record<ContactField, string>);
    setHydratedFor(data.store.id);
  }, [data, hydratedFor]);

  const saveMutation = useMutation({
    mutationFn: () => saveProfile({ data: { name, description, contact } }),
    onSuccess: async () => {
      toast.success(t("store.saved"));
      await queryClient.invalidateQueries({ queryKey: ["my-store"] });
      await queryClient.invalidateQueries({ queryKey: ["my-cards"] });
      await queryClient.invalidateQueries({ queryKey: ["store-join-link"] });
    },
    onError: (e: Error) => {
      if (e.message.includes("INVALID_NAME")) toast.error(t("store.nameInvalid"));
      else if (e.message.includes("DB_MIGRATION_REQUIRED")) toast.error(t("error.migrationNeeded"));
      else toast.error(t("common.error"));
    },
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
  const { values: contactValues, errors: contactErrors } = normalizeContact(contact);
  const stored = contactFromRow(data.store as unknown as Record<string, unknown>);
  const contactDirty = CONTACT_FIELDS.some((field) => (contactValues[field] ?? null) !== (stored[field] ?? null));
  const dirty = trimmed !== data.store.name || description.trim() !== (data.store.description ?? "") || contactDirty;

  const renderInput = ({ field, label, placeholder, hint, error, inputMode, ltr, maxLength }: ContactInputDef) => {
    const invalid = Boolean(contactErrors[field]) && (touched[field] || submitted);
    const id = `contact-${field}`;
    return (
      <div key={field}>
        <label htmlFor={id} className="text-sm font-semibold">
          {t(label)}
        </label>
        <input
          id={id}
          value={contact[field]}
          inputMode={inputMode}
          dir={ltr ? "ltr" : undefined}
          maxLength={maxLength}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : hint ? `${id}-hint` : undefined}
          placeholder={t(placeholder)}
          onChange={(event) => setContact((current) => ({ ...current, [field]: event.target.value }))}
          onBlur={() => setTouched((current) => ({ ...current, [field]: true }))}
          className={`mt-1 w-full rounded-md border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring ${ltr ? "rtl:text-right" : ""} ${invalid ? "border-destructive" : "border-border"}`}
        />
        {invalid ? (
          <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-semibold text-destructive">
            {t(error)}
          </p>
        ) : hint ? (
          <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
            {t(hint)}
          </p>
        ) : null}
      </div>
    );
  };
  const confirmed = confirmName.trim().toLowerCase() === data.store.name.trim().toLowerCase();

  return (
    <main className="min-h-screen pb-14">
      <AppHeader subtitle={data.store.name} />

      <section className="app-shell">
        <BackLink to="/merchant">{t("merchant.title")}</BackLink>
        <h1 className="mt-3 text-xl font-bold">{t("store.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("store.subtitle")}</p>

        <div className="mt-5">
          <StoreLogoSettings logoUrl={data.logoUrl} />
        </div>

        <form
          className="mt-5 space-y-4 rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!nameValid) {
              toast.error(t("store.nameInvalid"));
              return;
            }
            const firstError = CONTACT_INPUTS.concat(LINK_INPUTS).find((input) => contactErrors[input.field]);
            if (firstError) {
              setSubmitted(true);
              toast.error(t(firstError.error));
              document.getElementById(`contact-${firstError.field}`)?.focus();
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
          <div className="space-y-4 border-t border-border pt-4">
            <div>
              <h2 className="text-sm font-bold">{t("store.contact.title")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{t("store.contact.hint")}</p>
            </div>
            {CONTACT_INPUTS.map(renderInput)}
            {LINK_INPUTS.map(renderInput)}
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
