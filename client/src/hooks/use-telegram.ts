import { useEffect, useMemo, useState } from "react";

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
  colorScheme: "light" | "dark";
  isExpanded: boolean;
  viewportHeight: number;
  isClosingConfirmationEnabled: boolean;
}

export function useTelegram() {
  const [isReady, setIsReady] = useState(false);
  const [webAppData, setWebAppData] = useState<TelegramWebAppData>({
    theme: {},
    colorScheme: "light",
    isExpanded: false,
    viewportHeight: (typeof window !== "undefined" ? window.innerHeight : 600),
    isClosingConfirmationEnabled: false,
  });

  useEffect(() => {
    const initTelegram = () => {
      const tg = (window as any)?.Telegram?.WebApp;
      if (!tg) {
        setIsReady(true);
        return;
      }

      try {
        tg.ready();
        tg.expand?.();
        tg.enableClosingConfirmation?.();
      } catch {}

      // Only set TG-specific vars if you want CSS fallback to use them.
      // Do NOT touch --background/--foreground/etc (Tailwind tokens use HSL).
      const root = document.documentElement;
      if (tg.themeParams?.bg_color) {
        root.style.setProperty("--tg-theme-bg-color", tg.themeParams.bg_color);
      }
      if (tg.themeParams?.text_color) {
        root.style.setProperty("--tg-theme-text-color", tg.themeParams.text_color);
      }

      setWebAppData({
        user: tg.initDataUnsafe?.user,
        theme: tg.themeParams || {},
        colorScheme: tg.colorScheme === "dark" ? "dark" : "light",
        isExpanded: !!tg.isExpanded,
        viewportHeight: tg.viewportHeight || window.innerHeight,
        isClosingConfirmationEnabled: true,
      });

      const onViewport = () => {
        setWebAppData(prev => ({
          ...prev,
          viewportHeight: tg.viewportHeight || window.innerHeight,
          isExpanded: !!tg.isExpanded,
        }));
      };

      const onTheme = () => {
        const tp = tg.themeParams || {};
        if (tp.bg_color) root.style.setProperty("--tg-theme-bg-color", tp.bg_color);
        if (tp.text_color) root.style.setProperty("--tg-theme-text-color", tp.text_color);
        setWebAppData(prev => ({
          ...prev,
          theme: tp,
          colorScheme: tg.colorScheme === "dark" ? "dark" : "light",
        }));
      };

      tg.onEvent?.("viewportChanged", onViewport);
      tg.onEvent?.("themeChanged", onTheme);

      setIsReady(true);

      return () => {
        tg.offEvent?.("viewportChanged", onViewport);
        tg.offEvent?.("themeChanged", onTheme);
      };
    };

    if ((window as any)?.Telegram?.WebApp) {
      initTelegram();
    } else {
      // optional: load script in browser dev
      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-web-app.js";
      script.onload = initTelegram;
      document.head.appendChild(script);
      return () => {
        // no-op
      };
    }
  }, []);

  const hapticFeedback = useMemo(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    return tg?.HapticFeedback || null;
  }, []);

  const mainButton = {
    show(text: string, onClick: () => void) {
      const btn = (window as any)?.Telegram?.WebApp?.MainButton;
      if (!btn) return;
      btn.setText(text);
      btn.enable();
      btn.show();
      btn.onClick(onClick);
    },
    hide() { (window as any)?.Telegram?.WebApp?.MainButton?.hide?.(); },
    enable() { (window as any)?.Telegram?.WebApp?.MainButton?.enable?.(); },
    disable() { (window as any)?.Telegram?.WebApp?.MainButton?.disable?.(); },
    setLoader(loading: boolean) {
      const btn = (window as any)?.Telegram?.WebApp?.MainButton;
      if (!btn) return;
      loading ? btn.showProgress?.() : btn.hideProgress?.();
    },
  };

  const backButton = {
    show(onClick: () => void) {
      const btn = (window as any)?.Telegram?.WebApp?.BackButton;
      if (!btn) return;
      btn.onClick(onClick);
      btn.show();
    },
    hide() { (window as any)?.Telegram?.WebApp?.BackButton?.hide?.(); },
  };

  const close = () => (window as any)?.Telegram?.WebApp?.close?.();
  const sendData = (data: string) => {
    const wa = (window as any)?.Telegram?.WebApp;
    if (wa && "sendData" in wa) (wa as any).sendData(data);
  };

  return {
    isReady,
    webAppData,
    hapticFeedback,
    mainButton,
    backButton,
    close,
    sendData,
    isTelegramEnvironment: !!(window as any)?.Telegram?.WebApp,
  };
}

export const isTelegramWebApp = () =>
  typeof window !== "undefined" && !!(window as any)?.Telegram?.WebApp;