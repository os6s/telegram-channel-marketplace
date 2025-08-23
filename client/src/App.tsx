// client/src/App.tsx
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TelegramApp } from "@/components/telegram-app";
import { ThemeProvider } from "@/contexts/theme-context";
import { LanguageProvider, useLanguage } from "@/contexts/language-context";
import { lazy, Suspense, useMemo } from "react";
import { useTelegram } from "@/hooks/use-telegram";
import { TonConnectUIProvider } from "@tonconnect/ui-react";

// Lazy pages
const Marketplace = lazy(() => import("@/pages/marketplace"));
const SellPage = lazy(() => import("@/pages/sell/sellpage"));
const Activity = lazy(() => import("@/pages/activity"));
const Profile = lazy(() => import("@/pages/profile"));
const AdminPage = lazy(() => import("@/pages/admin"));
const DisputeDetailsPage = lazy(() => import("@/pages/disputes/[id]")); // ← صفحة النزاع المفرد
const NotFound = lazy(() => import("@/pages/not-found"));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-telegram-500"></div>
  </div>
);

function Router() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Switch>
        <Route path="/" component={Marketplace} />
        <Route path="/sell" component={SellPage} />
        <Route path="/sell-channel" component={SellPage} />
        <Route path="/activity" component={Activity} />
        <Route path="/profile" component={Profile} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/disputes/:id" component={DisputeDetailsPage} /> {/* ← روت النزاع */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function BottomNavigation() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const { hapticFeedback, webAppData } = useTelegram();

  const isAdmin = webAppData.user?.username === "Os6s7";

  const navItems = [
    { path: "/", label: t("marketplace"), icon: "🏠" },
    { path: "/sell", label: "List for sale", icon: "➕" }, // ← الطلب
    { path: "/activity", label: t("activity"), icon: "📊" },
    { path: "/profile", label: t("profile"), icon: "👤" },
    ...(isAdmin ? [{ path: "/admin", label: "Admin", icon: "🛡️" }] : []),
  ] as const;

  return (
    <div className="bg-background border-t border-border px-4 py-2 sticky bottom-0 z-50 safe-area-inset">
      <div className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
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

  return (
    <QueryClientProvider client={queryClient}>
      <TonConnectUIProvider manifestUrl={manifestUrl}>
        <ThemeProvider>
          <LanguageProvider>
            <TooltipProvider>
              <TelegramApp>
                <Toaster />
                <Router />
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