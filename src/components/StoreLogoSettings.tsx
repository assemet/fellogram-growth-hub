import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";
import { updateStoreLogo } from "@/lib/store.functions";

export function StoreLogoSettings({ logoUrl }: { logoUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const saveLogo = useServerFn(updateStoreLogo);
  const [preview, setPreview] = useState<string | null>(logoUrl);

  useEffect(() => setPreview(logoUrl), [logoUrl]);

  const mutation = useMutation({
    mutationFn: async (file: File | null) => {
      if (!file) return saveLogo({ data: { objectPath: null } });
      if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) throw new Error("INVALID_LOGO");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("UNAUTHORIZED");
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const objectPath = `${userData.user.id}/logo-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from("store-logos").upload(objectPath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      try {
        return await saveLogo({ data: { objectPath } });
      } catch (error) {
        await supabase.storage.from("store-logos").remove([objectPath]);
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success(t("store.logoSaved"));
      await queryClient.invalidateQueries({ queryKey: ["my-store"] });
      await queryClient.invalidateQueries({ queryKey: ["my-cards"] });
    },
    onError: () => toast.error(t("store.logoError")),
  });

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-lg font-bold">{t("store.profile")}</h2>
      <p className="text-sm text-muted-foreground">{t("store.logoHelp")}</p>
      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary">
          {preview ? <img src={preview} alt={t("store.logo")} className="h-full w-full object-cover" /> : <ImagePlus className="h-7 w-7 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setPreview(URL.createObjectURL(file));
              mutation.mutate(file);
              event.target.value = "";
            }}
          />
          <Button type="button" variant="outline" className="touch-action w-full" disabled={mutation.isPending} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
            {preview ? t("store.logoReplace") : t("store.logoUpload")}
          </Button>
          {preview && (
            <Button type="button" variant="ghost" className="touch-action w-full text-destructive" disabled={mutation.isPending} onClick={() => { setPreview(null); mutation.mutate(null); }}>
              <Trash2 className="h-4 w-4" />
              {t("store.logoRemove")}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}