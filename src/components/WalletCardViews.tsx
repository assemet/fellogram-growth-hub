import { Link } from "@tanstack/react-router";
import { Building2, ChevronRight, CreditCard, Gift, LayoutGrid, LayoutList } from "lucide-react";

import { PromoBadge } from "@/components/PromoBadge";
import type { StampCardData } from "@/components/StampCard";
import { brandThemeStyle, resolveCardTheme } from "@/lib/card-theme";
import { t } from "@/lib/i18n";
import { cardProgress, type WalletView } from "@/lib/wallet-view";

type WalletCard = StampCardData & { storeId: string };

function Avatar({ card, className }: { card: WalletCard; className: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden bg-[var(--store-primary)] text-[var(--store-on-primary)] ${className}`} aria-hidden="true">
      {card.logoUrl ? <img src={card.logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-1/2 w-1/2" />}
    </div>
  );
}

function ProgressBar({ balance, required }: { balance: number; required: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={balance} aria-valuemin={0} aria-valuemax={required} aria-label={t("wallet.card.progress")}>
      <div className="h-full rounded-full bg-[var(--store-primary)] transition-[width] duration-500" style={{ width: `${(balance / required) * 100}%` }} />
    </div>
  );
}

function ReadyBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-xs font-extrabold text-gold-foreground">
      <Gift className="h-3.5 w-3.5" aria-hidden="true" />
      {t("wallet.card.readyShort")}
    </span>
  );
}

/** One line per store: logo, name, progress. Tapping opens the full card. */
export function WalletCardRow({ card }: { card: WalletCard }) {
  const { balance, required, ready, remaining } = cardProgress(card);
  return (
    <li data-card-theme={resolveCardTheme(card.cardTheme)} style={brandThemeStyle(card.cardTheme, card)} className="animate-arrive">
      <Link to="/wallet" search={{ store: card.storeId }} className="touch-action flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-card)] transition-transform active:scale-[0.99]">
        <Avatar card={card} className="h-12 w-12 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate font-display text-base font-bold">{card.storeName}</p>
            <PromoBadge card={card} />
            {ready ? <ReadyBadge /> : <span className="shrink-0 text-sm font-bold tabular-nums text-muted-foreground">{balance}/{required}</span>}
          </div>
          <div className="mt-2">
            <ProgressBar balance={balance} required={required} />
          </div>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {ready ? (card.reward ? t("wallet.card.reward", { reward: card.reward }) : "") : t("wallet.card.toGo", { count: remaining })}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
      </Link>
    </li>
  );
}

/** Two per row: a coloured header with the store, and its progress underneath. */
export function WalletCardTile({ card }: { card: WalletCard }) {
  const { balance, required, ready } = cardProgress(card);
  return (
    <li data-card-theme={resolveCardTheme(card.cardTheme)} style={brandThemeStyle(card.cardTheme, card)} className="animate-arrive">
      <Link to="/wallet" search={{ store: card.storeId }} className="touch-action flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]">
        <div className="flex min-h-[4.5rem] items-center gap-2.5 bg-[var(--store-primary)] p-3 text-[var(--store-on-primary)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-current/25 bg-white/15" aria-hidden="true">
            {card.logoUrl ? <img src={card.logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-4 w-4" />}
          </div>
          <p className="line-clamp-2 min-w-0 flex-1 break-words font-display text-sm font-bold leading-snug">{card.storeName}</p>
        </div>
        <div className="mt-auto space-y-2 p-3">
          <ProgressBar balance={balance} required={required} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold tabular-nums">{balance}/{required}</span>
            <span className="flex items-center gap-1">
              <PromoBadge card={card} />
              {ready && <ReadyBadge />}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

const OPTIONS: { view: WalletView; Icon: typeof CreditCard }[] = [
  { view: "full", Icon: CreditCard },
  { view: "list", Icon: LayoutList },
  { view: "grid", Icon: LayoutGrid },
];

function viewLabel(view: WalletView): string {
  return view === "full" ? t("wallet.view.full") : view === "list" ? t("wallet.view.list") : t("wallet.view.grid");
}

/** Three-way switch; the choice is remembered on this device. */
export function WalletViewToggle({ view, onChange }: { view: WalletView; onChange: (next: WalletView) => void }) {
  return (
    <div role="group" aria-label={t("wallet.view.label")} className="inline-flex rounded-lg border border-border bg-card p-0.5">
      {OPTIONS.map(({ view: option, Icon }) => (
        <button
          key={option}
          type="button"
          aria-pressed={view === option}
          aria-label={viewLabel(option)}
          title={viewLabel(option)}
          onClick={() => onChange(option)}
          className={`touch-action flex h-9 w-10 items-center justify-center rounded-md transition-colors ${view === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
