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
import { useTelegram } from "@/hooks/use-telegram";
import { TonConnectUIProvider } from '@tonconnect/ui-react';

// Lazy load pages for better performance
const Marketplace = lazy(() => import("@/components/enhanced-marketplace"));
const SellPage = lazy(() => import("@/pages/sell"));  // <-- تم التعديل هنا
const Activity = lazy(() => import("@/pages/activity"));
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
        <Route path="/sell" component={SellPage} />
        <Route path="/sell-channel" component={SellPage} /> {/* توجه إلى نفس الصفحة */}
        <Route path="/activity" component={Activity} />
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
  const { hapticFeedback } = useTelegram();

  const handleNavClick = (path: string) => {
    if (hapticFeedback) {
      hapticFeedback.selection();
    }
    // Navigation will be handled by Link component
  };

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
      label: t('sellChannel') // ممكن تغير هذا النص في ملف الترجمة إذا تريد
    },
    {
      path: "/activity",
      icon: (
        <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M9,5V7H15V5H9M12,2A7,7 0 0,1 19,9C19,11.38 17.81,13.47 16,14.74V17A1,1 0 0,1 15,18H9A1,1 0 0,1 8,17V14.74C6.19,13.47 5,11.38 5,9A7,7 0 0,1 12,2M9,12H15A2,2 0 0,1 17,14V15H7V14A2,2 0 0,1 9,12Z"/>
        </svg>
      ),
      label: t('activity')
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
    <div className="bg-background border-t border-border px-4 py-2 sticky bottom-0 z-50 safe-area-inset">
      <div className="grid grid-cols-4 gap-1">
        {navItems.map((item) => (
          <Link 
            key={item.path} 
            href={item.path} 
            className={`flex flex-col items-center py-2 transition-colors ${
              location === item.path 
                ? 'text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => handleNavClick(item.path)}
          >
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
      <TonConnectUIProvider 
        manifestUrl={
          window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? '/tonconnect-manifest.json'
            : 'https://telegram-channel-marketplace.onrender.com/tonconnect-manifest.json'
        }
      >
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