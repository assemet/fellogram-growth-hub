import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseStoreCode } from "@/lib/join-code";
import { t } from "@/lib/i18n";
import { openTelegramQrScanner } from "@/lib/telegram";

/**
 * Scan a store's join QR without leaving the app. Uses Telegram's built-in scanner when
 * available, otherwise an in-page camera view. Either way it ends on the store's join screen.
 */
export function StoreScanButton({
  label,
  variant = "default",
  className = "",
}: {
  label?: string;
  variant?: "default" | "outline";
  className?: string;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const lastInvalid = useRef<string | null>(null);

  const goToStore = (raw: string): boolean => {
    const storeId = parseStoreCode(raw);
    if (!storeId) return false;
    navigate({ to: "/join/$storeId", params: { storeId } });
    return true;
  };

  const start = () => {
    // Native Telegram scanner keeps scanning until it sees a valid store code.
    if (!openTelegramQrScanner(t("wallet.scan.hint"), goToStore)) setOpen(true);
  };

  useEffect(() => {
    if (!open || !video) return;
    let scanner: { stop: () => void; destroy: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const QrScanner = (await import("qr-scanner")).default;
        if (cancelled) return;
        const instance = new QrScanner(
          video,
          (result: { data: string }) => {
            if (goToStore(result.data)) {
              setOpen(false);
            } else if (lastInvalid.current !== result.data) {
              lastInvalid.current = result.data;
              toast.error(t("wallet.scan.invalid"));
            }
          },
          { highlightScanRegion: true, maxScansPerSecond: 5 },
        );
        scanner = instance as unknown as { stop: () => void; destroy: () => void };
        await instance.start();
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setOpen(false);
          toast.error(t("wallet.scan.cameraError"));
        }
      }
    })();
    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
    // goToStore only closes over stable setters/navigate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, video]);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        onClick={start}
        className={`touch-action h-14 gap-2 text-base font-bold ${className}`}
      >
        <Camera className="h-5 w-5" />
        {label ?? t("wallet.scan.action")}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) lastInvalid.current = null;
          setOpen(next);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("wallet.scan.action")}</DialogTitle>
            <DialogDescription>{t("wallet.scan.hint")}</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-md bg-foreground">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={setVideo} className="aspect-square w-full object-cover" playsInline muted />
          </div>
          <Button type="button" variant="outline" className="touch-action h-12 w-full" onClick={() => setOpen(false)}>
            {t("wallet.scan.close")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
