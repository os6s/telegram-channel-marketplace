import { useEffect, useState } from 'react';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramTheme {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

export interface TelegramWebAppData {
  user?: TelegramUser;
  theme: TelegramTheme;
  colorScheme: 'light' | 'dark';
  isExpanded: boolean;
  viewportHeight: number;
  isClosingConfirmationEnabled: boolean;
}

export function useTelegram() {
  const [isReady, setIsReady] = useState(false);
  const [webAppData, setWebAppData] = useState<TelegramWebAppData>({
    theme: {},
    colorScheme: 'light',
    isExpanded: false,
    viewportHeight: window.innerHeight,
    isClosingConfirmationEnabled: false
  });

  useEffect(() => {
    const initTelegram = () => {
      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        
        // Initialize Web App
        tg.ready();
        tg.expand();
        
        // Update state with Telegram data
        setWebAppData({
          user: tg.initDataUnsafe.user,
          theme: tg.themeParams,
          colorScheme: tg.colorScheme,
          isExpanded: true, // Assume expanded after calling expand()
          viewportHeight: window.innerHeight,
          isClosingConfirmationEnabled: true
        });

        // Apply Telegram theme to CSS variables
        applyTelegramTheme(tg.themeParams);
        
        setIsReady(true);
      } else {
        // Fallback for development/browser testing
        setIsReady(true);
      }
    };

    if (window.Telegram?.WebApp) {
      initTelegram();
    } else {
      // Wait for Telegram script to load
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.onload = initTelegram;
      document.head.appendChild(script);
    }
  }, []);

  // Apply Telegram theme colors to CSS variables
  const applyTelegramTheme = (theme: TelegramTheme) => {
    const root = document.documentElement;
    
    if (theme.bg_color) {
      root.style.setProperty('--tg-theme-bg-color', theme.bg_color);
    }
    if (theme.text_color) {
      root.style.setProperty('--tg-theme-text-color', theme.text_color);
    }
    if (theme.button_color) {
      root.style.setProperty('--tg-theme-button-color', theme.button_color);
    }
    if (theme.button_text_color) {
      root.style.setProperty('--tg-theme-button-text-color', theme.button_text_color);
    }
    if (theme.link_color) {
      root.style.setProperty('--tg-theme-link-color', theme.link_color);
    }
  };

  // Haptic feedback functions
  const hapticFeedback = {
    impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') => {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
    },
    notification: (type: 'error' | 'success' | 'warning' = 'success') => {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);
    },
    selection: () => {
      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
    }
  };

  // Main button control
  const mainButton = {
    show: (text: string, onClick: () => void) => {
      if (window.Telegram?.WebApp?.MainButton) {
        const btn = window.Telegram.WebApp.MainButton;
        btn.setText(text);
        btn.show();
        btn.onClick(onClick);
      }
    },
    hide: () => {
      window.Telegram?.WebApp?.MainButton?.hide();
    },
    enable: () => {
      window.Telegram?.WebApp?.MainButton?.enable();
    },
    disable: () => {
      window.Telegram?.WebApp?.MainButton?.disable();
    }
  };

  // Back button control
  const backButton = {
    show: (onClick: () => void) => {
      if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(onClick);
      }
    },
    hide: () => {
      window.Telegram?.WebApp?.BackButton?.hide();
    }
  };

  // Close app
  const close = () => {
    window.Telegram?.WebApp?.close();
  };

  // Send data to bot (note: sendData might not be available in all versions)
  const sendData = (data: string) => {
    if (window.Telegram?.WebApp && 'sendData' in window.Telegram.WebApp) {
      (window.Telegram.WebApp as any).sendData(data);
    }
  };

  return {
    isReady,
    webAppData,
    hapticFeedback,
    mainButton,
    backButton,
    close,
    sendData,
    isTelegramEnvironment: !!window.Telegram?.WebApp
  };
}

// Utility function to check if running in Telegram
export const isTelegramWebApp = () => {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp;
};