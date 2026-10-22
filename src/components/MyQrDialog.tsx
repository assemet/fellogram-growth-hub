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
        <Button type="button" variant="outline" size="sm" className="touch-action h-10 shrink-0 gap-2 font-semibold">
          <QrCode className="h-4 w-4" />
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
