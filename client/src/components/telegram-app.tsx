import { useEffect, ReactNode } from "react";
import { telegramWebApp } from "@/lib/telegram";

interface TelegramAppProps {
  children: ReactNode;
}

export function TelegramApp({ children }: TelegramAppProps) {
  useEffect(() => {
    // Initialize Telegram Web App
    telegramWebApp.initialize();
    
    // Add script tag for Telegram Web App SDK if not already present
    if (!document.querySelector('script[src*="telegram-web-app.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.async = true;
      document.head.appendChild(script);
    }

    return () => {
      // Cleanup if needed
      telegramWebApp.hideMainButton();
      telegramWebApp.hideBackButton();
    };
  }, []);

  return (
    <div className="telegram-web-app min-h-screen bg-background">
      {children}
    </div>
  );
}
