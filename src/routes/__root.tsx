import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LOAD_GUARD_SCRIPT } from "@/lib/load-guard";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "../components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Button } from "../components/ui/button";
import { BootSplash } from "../components/SplashScreen";
import { useLocale } from "../hooks/useLocale";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { LOCALES, t } from "../lib/i18n";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("error.notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("error.notFound.body")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

// A stale module graph (dev-server dependency re-optimisation, a half-loaded
// chunk after a restart) can leave two React copies loaded. Hooks then throw
// inside this boundary too, so the fallback never renders and the screen goes
// blank. Reloading is the only recovery that does not itself need working
// hooks, so do it once and no more.
const RELOAD_FLAG = "fellogram-error-reload";

function reloadOnce(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(RELOAD_FLAG)) return false;
    window.sessionStorage.setItem(RELOAD_FLAG, "1");
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

// Hook-free on purpose: when the crash is a broken module graph, any hook here
// throws again and the visitor is left staring at a blank page.
function ErrorComponent({ error }: { error: unknown }) {
  if (reloadOnce()) return null;

  console.error(error);
  reportLovableError(error, { boundary: "tanstack_root_error_component" });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("error.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("error.body")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>{t("error.reload")}</Button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("error.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "theme-color", content: "#f3f7ff", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#0d1636", media: "(prefers-color-scheme: dark)" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Fellogram — Turn loyalty into growth" },
      {
        name: "description",
        content:
          "Telegram-native loyalty and customer growth for small businesses: stamps, rewards and referrals.",
      },
      { name: "author", content: "Fellogram" },
      { property: "og:title", content: "Fellogram — Turn loyalty into growth" },
      {
        property: "og:description",
        content: "Turn visits into stamps, stamps into rewards and rewards into new customers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // The Latin text font is needed on every screen, so fetch it before the CSS asks for it. The Arabic font is
      // preloaded by the inline language script below, only for Arabic, so English never downloads it.
      { rel: "preload", href: "/fonts/dm-sans-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "preload", as: "image", href: "/logo-mascot.png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Reloads once when a cached page asks for app files that no longer exist, and replaces a blank screen with a message. */}
        <script dangerouslySetInnerHTML={{ __html: LOAD_GUARD_SCRIPT }} />
        {/* Must load before the app so Telegram's session data is available on mount. */}
        <script src="https://telegram.org/js/telegram-web-app.js" />
        {/* Set language/direction before first paint so Arabic never flashes as LTR English. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var S=${JSON.stringify(LOCALES.map((item) => item.code))},R=${JSON.stringify(LOCALES.filter((item) => item.dir === "rtl").map((item) => item.code))};function m(t){t=String(t||'').toLowerCase().replace('_','-').split('-')[0];return S.indexOf(t)>-1?t:null}var l=m(localStorage.getItem('fellogram.locale'));if(!l){var w=window.Telegram&&Telegram.WebApp&&Telegram.WebApp.initDataUnsafe&&Telegram.WebApp.initDataUnsafe.user;var c=[w&&w.language_code].concat(navigator.languages&&navigator.languages.length?Array.prototype.slice.call(navigator.languages):[navigator.language]);for(var i=0;i<c.length&&!l;i++)l=m(c[i])}l=l||'en';document.documentElement.lang=l;document.documentElement.dir=R.indexOf(l)>-1?'rtl':'ltr';if(l==='ar'){var k=document.createElement('link');k.rel='preload';k.as='font';k.type='font/woff2';k.href='/fonts/cairo-arabic.woff2';k.crossOrigin='anonymous';document.head.appendChild(k)}}catch(e){}try{if(localStorage.getItem('fellogram.appearance')==='dark')document.documentElement.classList.add('dark');if(localStorage.getItem('fellogram.textSize')==='large')document.documentElement.style.fontSize='112.5%'}catch(e){}`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  // Remount the routed page when the language changes so every t() call picks up the new language.
  const locale = useLocale();
  useTelegramBackButton();
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // The app came up and stayed up, so a later crash earns one more reload.
    // The delay keeps a crash-on-boot from looping reload forever.
    const timer = setTimeout(() => {
      try {
        window.sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        /* storage unavailable: the guard simply stays armed */
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet key={locale} />
      <BootSplash />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
