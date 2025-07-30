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
        
        // Enable closing confirmation
        tg.enableClosingConfirmation();
        
        // Set header color to match theme
        if (tg.themeParams.bg_color) {
          tg.setHeaderColor(tg.themeParams.bg_color);
        }
        
        // Update state with Telegram data
        setWebAppData({
          user: tg.initDataUnsafe.user,
          theme: tg.themeParams,
          colorScheme: tg.colorScheme,
          isExpanded: tg.isExpanded,
          viewportHeight: tg.viewportHeight || window.innerHeight,
          isClosingConfirmationEnabled: true
        });

        // Apply Telegram theme to CSS variables
        applyTelegramTheme(tg.themeParams);
        
        // Listen for viewport changes
        tg.onEvent('viewportChanged', () => {
          setWebAppData(prev => ({
            ...prev,
            viewportHeight: tg.viewportHeight || window.innerHeight,
            isExpanded: tg.isExpanded
          }));
        });
        
        // Listen for theme changes
        tg.onEvent('themeChanged', () => {
          const newTheme = tg.themeParams;
          applyTelegramTheme(newTheme);
          setWebAppData(prev => ({
            ...prev,
            theme: newTheme,
            colorScheme: tg.colorScheme
          }));
        });
        
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
    
    // Apply all available theme colors
    if (theme.bg_color) {
      root.style.setProperty('--tg-theme-bg-color', theme.bg_color);
      root.style.setProperty('--background', theme.bg_color);
    }
    if (theme.text_color) {
      root.style.setProperty('--tg-theme-text-color', theme.text_color);
      root.style.setProperty('--foreground', theme.text_color);
    }
    if (theme.hint_color) {
      root.style.setProperty('--tg-theme-hint-color', theme.hint_color);
      root.style.setProperty('--muted-foreground', theme.hint_color);
    }
    if (theme.button_color) {
      root.style.setProperty('--tg-theme-button-color', theme.button_color);
      root.style.setProperty('--primary', theme.button_color);
    }
    if (theme.button_text_color) {
      root.style.setProperty('--tg-theme-button-text-color', theme.button_text_color);
      root.style.setProperty('--primary-foreground', theme.button_text_color);
    }
    if (theme.link_color) {
      root.style.setProperty('--tg-theme-link-color', theme.link_color);
      root.style.setProperty('--accent', theme.link_color);
    }
    if (theme.secondary_bg_color) {
      root.style.setProperty('--tg-theme-secondary-bg-color', theme.secondary_bg_color);
      root.style.setProperty('--card', theme.secondary_bg_color);
    }
    
    // Update document background
    document.body.style.backgroundColor = theme.bg_color || '#ffffff';
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
        btn.enable();
        btn.show();
        btn.offClick(onClick); // Remove previous listeners
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
    },
    setLoader: (loading: boolean) => {
      if (window.Telegram?.WebApp?.MainButton) {
        if (loading) {
          window.Telegram.WebApp.MainButton.showProgress();
        } else {
          window.Telegram.WebApp.MainButton.hideProgress();
        }
      }
    }
  };

  // Back button control
  const backButton = {
    show: (onClick: () => void) => {
      if (window.Telegram?.WebApp?.BackButton) {
        const btn = window.Telegram.WebApp.BackButton;
        btn.offClick(onClick); // Remove previous listeners
        btn.onClick(onClick);
        btn.show();
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