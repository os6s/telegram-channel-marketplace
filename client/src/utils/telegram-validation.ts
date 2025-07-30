// Telegram Mini App validation and utilities

export interface TelegramInitData {
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
  };
  auth_date: number;
  hash: string;
}

export function isTelegramEnvironment(): boolean {
  return typeof window !== 'undefined' && 
         !!window.Telegram?.WebApp &&
         window.Telegram.WebApp.initData !== '';
}

export function getTelegramUser() {
  if (!isTelegramEnvironment()) {
    return null;
  }
  
  return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
}

export function isValidTelegramData(): boolean {
  if (!isTelegramEnvironment()) {
    return false;
  }
  
  const webApp = window.Telegram?.WebApp;
  return !!(webApp?.initData && webApp?.initDataUnsafe?.user?.id);
}

export function getTelegramTheme() {
  if (!isTelegramEnvironment()) {
    return null;
  }
  
  return window.Telegram?.WebApp?.themeParams || null;
}

export function sendTelegramHapticFeedback(type: 'impact' | 'notification' | 'selection', style?: string) {
  if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
    return;
  }
  
  const haptic = window.Telegram.WebApp.HapticFeedback;
  if (!haptic) return;
  
  try {
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
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
}