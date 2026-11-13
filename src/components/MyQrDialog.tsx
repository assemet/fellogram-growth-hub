import { QrCode } from "lucide-react";

import { CustomerQr } from "@/components/CustomerQr";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { t } from "@/lib/i18n";

/** "Show my QR" opens the customer QR on demand instead of occupying the top of the wallet. */
export function MyQrDialog({ customerId }: { customerId: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" className="touch-action h-12 w-full gap-2 text-base font-extrabold">
          <QrCode className="h-5 w-5" />
          {t("wallet.showQr")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">{t("qr.title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("qr.subtitle")}</DialogDescription>
        <CustomerQr customerId={customerId} />
      </DialogContent>
    </Dialog>
  );
}
