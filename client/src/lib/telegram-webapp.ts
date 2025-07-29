// Enhanced Telegram WebApp integration
export interface TelegramWebApp {
  ready(): void;
  close(): void;
  expand(): void;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
  };
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
  };
  BackButton: {
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    setText(text: string): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

// Check if running in Telegram WebApp
export const isTelegramWebApp = (): boolean => {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp;
};

// Get Telegram user data
export const getTelegramUser = () => {
  if (isTelegramWebApp()) {
    return window.Telegram?.WebApp?.initDataUnsafe?.user;
  }
  return null;
};

// Initialize Telegram WebApp
export const initTelegramWebApp = () => {
  if (isTelegramWebApp()) {
    window.Telegram!.WebApp.ready();
    window.Telegram!.WebApp.expand();
    return window.Telegram!.WebApp;
  }
  return null;
};

// Theme helpers
export const getTelegramTheme = () => {
  if (isTelegramWebApp()) {
    return {
      colorScheme: window.Telegram!.WebApp.colorScheme,
      themeParams: window.Telegram!.WebApp.themeParams,
    };
  }
  return null;
};

// Haptic feedback
export const triggerHaptic = (type: 'impact' | 'notification' | 'selection', style?: string) => {
  if (isTelegramWebApp()) {
    const haptic = window.Telegram!.WebApp.HapticFeedback;
    
    switch (type) {
      case 'impact':
        haptic.impactOccurred((style as any) || 'medium');
        break;
      case 'notification':
        haptic.notificationOccurred((style as any) || 'success');
        break;
      case 'selection':
        haptic.selectionChanged();
        break;
    }
  }
};