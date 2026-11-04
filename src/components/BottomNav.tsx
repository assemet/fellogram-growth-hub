import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ScanLine, Settings, Store, Wallet } from "lucide-react";

import { useMyContext } from "@/hooks/useMyContext";
import { t } from "@/lib/i18n";
import { rememberTab, TAB_PATH, tabsFor, type Tab } from "@/lib/start-tab";

const TAB_ICON = { wallet: Wallet, cashier: ScanLine, merchant: Store, settings: Settings } as const;
const TAB_LABEL = { wallet: "nav.wallet", cashier: "nav.cashier", merchant: "nav.store", settings: "nav.settings" } as const;

/** The software keyboard shrinks the visual viewport; a bar stuck above it would squeeze the form being typed in. */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const check = () => setOpen(viewport.height < window.innerHeight * 0.75);
    check();
    viewport.addEventListener("resize", check);
    return () => viewport.removeEventListener("resize", check);
  }, []);
  return open;
}

/**
 * Fixed bottom navigation between the main screens a person may use. Shown only when there is more
 * than one (customers who own nothing see none). Inner screens use Telegram's own Back button instead.
 */
export function BottomNav({ current }: { current: Tab }) {
  const { data } = useMyContext(true);
  const keyboardOpen = useKeyboardOpen();

  // Opening the app again lands on the tab used last.
  useEffect(() => {
    if (current !== "settings") rememberTab(current);
  }, [current]);

  const tabs = tabsFor({ isOwner: Boolean(data?.ownedStoreId), isStaff: Boolean(data?.staffStoreId) });
  // Wait for the role so the bar does not appear with two tabs and then grow to four.
  const visible = Boolean(data) && !keyboardOpen;

  // Pages keep their content clear of the bar through one class on <body> (see styles.css).
  useEffect(() => {
    document.body.classList.toggle("has-bottom-nav", visible);
    return () => document.body.classList.remove("has-bottom-nav");
  }, [visible]);

  if (!visible) return null;

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur [padding-bottom:env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex w-full max-w-[30rem] px-2">
        {tabs.map((tab) => {
          const Icon = TAB_ICON[tab];
          const active = tab === current;
          return (
            <li key={tab} className="flex-1">
              <Link
                to={TAB_PATH[tab]}
                aria-current={active ? "page" : undefined}
                className={`touch-action flex h-14 flex-col items-center justify-center gap-0.5 rounded-md text-[0.6875rem] font-semibold transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.4]" : ""}`} aria-hidden="true" />
                <span>{t(TAB_LABEL[tab])}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
