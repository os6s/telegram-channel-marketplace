import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TelegramApp } from "@/components/telegram-app";
import { ThemeProvider } from "@/contexts/theme-context";
import { LanguageProvider } from "@/contexts/language-context";
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <TooltipProvider>
            <TelegramApp>
              <Toaster />
              <Router />
          
          {/* Bottom Navigation */}
          <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-2 sticky bottom-0 z-50">
            <div className="grid grid-cols-4 gap-1">
              <a 
                href="/"
                className="flex flex-col items-center py-2 text-telegram-500 dark:text-telegram-400"
              >
                <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span className="text-xs font-medium">Marketplace</span>
              </a>
              
              <a 
                href="/sell"
                className="flex flex-col items-center py-2 text-gray-400 dark:text-gray-500 hover:text-telegram-500 dark:hover:text-telegram-400"
              >
                <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                </svg>
                <span className="text-xs">Sell Channel</span>
              </a>
              
              <a 
                href="/escrows"
                className="flex flex-col items-center py-2 text-gray-400 hover:text-telegram-500"
              >
                <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,7C13.4,7 14.8,8.6 14.8,10V11H16V18H8V11H9.2V10C9.2,8.6 10.6,7 12,7M12,8.2C11.2,8.2 10.4,8.7 10.4,10V11H13.6V10C13.6,8.7 12.8,8.2 12,8.2Z"/>
                </svg>
                <span className="text-xs">Escrows</span>
              </a>
              
              <a 
                href="/profile"
                className="flex flex-col items-center py-2 text-gray-400 hover:text-telegram-500"
              >
                <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1.5V1.5C14.3 1.5 13.6 1.7 13 2L13 2C13.7 2.6 14.3 3.3 14.8 4.1C15.9 3.8 17 4 18 4.5L21 9ZM1 9L4 4.5C5 4 6.1 3.8 7.2 4.1C7.7 3.3 8.3 2.6 9 2C8.4 1.7 7.7 1.5 7 1.5L1 7V9ZM12 7C14.8 7 17 9.2 17 12S14.8 17 12 17 7 14.8 7 12 9.2 7 12 7ZM12 9C10.3 9 9 10.3 9 12S10.3 15 12 15 15 13.7 15 12 13.7 9 12 9ZM21 20C21 18.3 19.7 17 18 17H6C4.3 17 3 18.3 3 20V22H21V20Z"/>
                </svg>
                <span className="text-xs">Profile</span>
              </a>
            </div>
          </div>
            </TelegramApp>
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
