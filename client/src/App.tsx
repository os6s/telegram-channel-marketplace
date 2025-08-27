// client/src/App.tsx
import { Switch, Route, Link, useLocation } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TelegramApp } from "@/components/telegram-app";
import { ThemeProvider } from "@/contexts/theme-context";
import { LanguageProvider, useLanguage } from "@/contexts/language-context";
import { lazy, Suspense, useMemo } from "react";
import { useTelegram } from "@/hooks/use-telegram";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { Button } from "@/components/ui/button";

/* -------- Lazy pages -------- */
const Marketplace = lazy(() => import("@/pages/marketplace"));
const SellPage = lazy(() => import("@/pages/sell/sellpage"));
const Activity = lazy(() => import("@/pages/activity"));
const Profile = lazy(() => import("@/pages/profile"));
const AdminPage = lazy(() => import("@/pages/admin"));
const DisputesIndex = lazy(() => import("@/pages/disputes"));
const DisputeDetailsPage = lazy(() => import("@/pages/disputes/[id]"));
const NotFound = lazy(() => import("@/pages/not-found"));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-telegram-500" />
  </div>
);

/* -------- Router -------- */
function Router() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Switch>
        <Route path="/" component={() => (<ErrorBoundary><Marketplace /></ErrorBoundary>)} />
        <Route path="/sell" component={() => (<ErrorBoundary><SellPage /></ErrorBoundary>)} />
        <Route path="/activity" component={() => (<ErrorBoundary><Activity /></ErrorBoundary>)} />
        <Route path="/profile" component={() => (<ErrorBoundary><Profile /></ErrorBoundary>)} />
        <Route path="/admin" component={() => (<ErrorBoundary><AdminPage /></ErrorBoundary>)} />
        <Route path="/disputes" component={() => (<ErrorBoundary><DisputesIndex /></ErrorBoundary>)} />
        <Route path="/disputes/:id" component={() => (<ErrorBoundary><DisputeDetailsPage /></ErrorBoundary>)} />
        <Route component={() => (<ErrorBoundary><NotFound /></ErrorBoundary>)} />
      </Switch>
    </Suspense>
  );
}

/* -------- Bottom Navigation -------- */
function BottomNavigation() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const { hapticFeedback } = useTelegram();

  const { data: me } = useQuery({
    queryKey: ["/api/me"],
    queryFn: async () => {
      try { const r = await fetch("/api/me"); return r.ok ? await r.json() : null; }
      catch { return null; }
    },
    retry: false,
  });

  const isAdmin = me?.role === "admin";

  const navItems = [
    { path: "/", label: t("marketplace"), icon: "🏠" },
    { path: "/activity", label: t("activity"), icon: "📊" },
    { path: "/disputes", label: t("disputes.title"), icon: "🛡️" },
    { path: "/profile", label: t("profile"), icon: "👤" },
    ...(isAdmin ? [{ path: "/admin", label: "Admin", icon: "🧰" }] : []),
  ] as const;

  return (
    <div className="bg-background border-t border-border px-4 py-2 sticky bottom-0 z-40 safe-area-inset">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
        {navItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`flex flex-col items-center py-2 transition-colors ${
              location === item.path ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => hapticFeedback?.selection?.()}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-xs">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function App() {
  const manifestUrl = useMemo(() => {
    return typeof window !== "undefined"
      ? `${window.location.origin}/tonconnect-manifest.json`
      : "/tonconnect-manifest.json";
  }, []);

  const botUsername =
    (window as any)?.Telegram?.WebApp?.initDataUnsafe?.bot_username ||
    (window as any)?.Telegram?.WebApp?.Bot?.username ||
    "";

  const APP_NET =
    (import.meta as any).env?.VITE_TON_NETWORK === "TESTNET" ? "TESTNET" : "MAINNET";

  return (
    <QueryClientProvider client={queryClient}>
      <TonConnectUIProvider
        manifestUrl={manifestUrl}
        returnStrategy="back"
        actionsConfiguration={{
          twaReturnUrl: botUsername ? `https://t.me/Giftspremarketbot?startapp` : undefined,
        }}
        walletsListConfiguration={{
          network: APP_NET,
        }}
      >
        <ThemeProvider>
          <LanguageProvider>
            <TooltipProvider>
              <TelegramApp>
                <Toaster />
                <Router />
                <Link href="/sell" className="fixed bottom-20 right-4 z-50">
                  <Button className="rounded-full w-14 h-14 bg-green-500 hover:bg-green-600 shadow-lg text-white text-2xl">
                    +
                  </Button>
                </Link>
                <BottomNavigation />
              </TelegramApp>
            </TooltipProvider>
          </LanguageProvider>
        </ThemeProvider>
      </TonConnectUIProvider>
    </QueryClientProvider>
  );
}

export default App;