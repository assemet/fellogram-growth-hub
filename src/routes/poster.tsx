import { createFileRoute } from "@tanstack/react-router";
import { Download, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { dirOf, getLocale, isLocale, setLocale, t } from "@/lib/i18n";
import { downloadBlob, posterAddress, printPosterImage, readPosterParams, renderPoster } from "@/lib/poster";

/**
 * Standalone, sign-in-free page that draws a store's poster. Telegram's phone apps cannot print or save files,
 * so the dashboard opens this page in the phone's own browser, where the two buttons below work normally.
 */
export const Route = createFileRoute("/poster")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => search,
  head: () => ({ meta: [{ title: "Poster — Fellogram" }, { name: "robots", content: "noindex" }] }),
  component: PosterPage,
});

function PosterPage() {
  const search = Route.useSearch();
  const params = readPosterParams(search);
  const [image, setImage] = useState<{ url: string; blob: Blob } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!params) return;
    if (isLocale(params.lang)) setLocale(params.lang);
    let url: string | null = null;
    let cancelled = false;
    renderPoster(
      params.link,
      {
        name: params.name,
        caption: t("join.poster.scan"),
        powered: t("join.poster.powered"),
        address: posterAddress(params.link),
      },
      dirOf(getLocale()),
    )
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage({ url, blob });
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.name, params?.link, params?.lang]);

  if (!params || failed) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">{t("error.notFound.title")}</p>
      </main>
    );
  }

  // Straight to the device: a share sheet would offer mail and chat apps but not "save".
  const download = () => {
    if (!image) return;
    downloadBlob(image.blob, "fellogram-poster.png");
  };

  const print = async () => {
    if (!image) return;
    try {
      await printPosterImage(image.url, params.name);
    } catch {
      toast.error(t("join.share.printError"));
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 pb-8">
      <AppHeader />
      {image ? (
        <img src={image.url} alt={params.name} className="w-full rounded-md border border-border bg-white" />
      ) : (
        <div className="aspect-[210/297] w-full animate-pulse rounded-md bg-muted" />
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-12 gap-2 font-semibold" onClick={print} disabled={!image}>
          <Printer className="h-4 w-4" />
          {t("join.share.print")}
        </Button>
        <Button type="button" className="h-12 gap-2 font-semibold" onClick={download} disabled={!image}>
          <Download className="h-4 w-4" />
          {t("join.share.save")}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">{t("join.share.saveHint")}</p>
    </main>
  );
}
