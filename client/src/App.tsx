import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TelegramApp } from "@/components/telegram-app";
import { ThemeProvider } from "@/contexts/theme-context";
import { LanguageProvider } from "@/contexts/language-context";
import { useLanguage } from "@/contexts/language-context";
import { lazy, Suspense } from "react";

// Lazy load pages for better performance
const Marketplace = lazy(() => import("@/components/enhanced-marketplace"));
const SellChannel = lazy(() => import("@/pages/enhanced-sell-channel"));
const Escrows = lazy(() => import("@/pages/escrows"));
const Profile = lazy(() => import("@/pages/profile"));
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
        <Route path="/sell" component={SellChannel} />
        <Route path="/escrows" component={Escrows} />
        <Route path="/profile" component={Profile} />
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function BottomNavigation() {
  const [location] = useLocation();
  const { t } = useLanguage();

  const navItems = [
    {
      path: "/",
      icon: (
        <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ),
      label: t('marketplace')
    },
    {
      path: "/sell",
      icon: (
        <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
        </svg>
      ),
      label: t('sellChannel')
    },
    {
      path: "/escrows",
      icon: (
        <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V18H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
        </svg>
      ),
      label: t('escrows')
    },
    {
      path: "/profile",
      icon: (
        <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      ),
      label: t('profile')
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-2 sticky bottom-0 z-50">
      <div className="grid grid-cols-4 gap-1">
        {navItems.map((item) => (
          <Link key={item.path} href={item.path} className={`flex flex-col items-center py-2 transition-colors ${
            location === item.path 
              ? 'text-telegram-500 dark:text-telegram-400' 
              : 'text-gray-400 dark:text-gray-500 hover:text-telegram-500 dark:hover:text-telegram-400'
          }`}>
            {item.icon}
            <span className="text-xs">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}

export default App;
