// client/src/components/telegram-app.tsx
import { ReactNode, useMemo, useEffect } from "react";
import { useTelegram } from "@/hooks/use-telegram";
import { useTheme } from "@/contexts/theme-context";

interface Props { children: ReactNode }

export function TelegramApp({ children }: Props) {
  const { isReady, webAppData, isTelegramEnvironment } = useTelegram();
  const { theme } = useTheme(); // "light" | "dark" | "system"

  // حساب ألوان حسب الثيم
  const resolvedScheme =
    theme === "system" ? webAppData.colorScheme : theme;

  const bgColor =
    theme === "system"
      ? (webAppData.theme?.bg_color ||
         (webAppData.colorScheme === "dark" ? "#0f0f0f" : "#ffffff"))
      : (theme === "dark" ? "#0f0f0f" : "#ffffff");

  const textColor =
    theme === "system"
      ? (webAppData.theme?.text_color ||
         (webAppData.colorScheme === "dark" ? "#ffffff" : "#000000"))
      : (theme === "dark" ? "#ffffff" : "#000000");

  // setHeaderColor + setBackgroundColor
  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (!tg) return;

    try {
      tg.setHeaderColor(resolvedScheme === "dark" ? "secondary_bg_color" : "bg_color");
    } catch {}

    try {
      tg.setBackgroundColor(bgColor);
    } catch {}
  }, [resolvedScheme, bgColor]);

  const containerStyle = useMemo<React.CSSProperties>(() => {
    const base: React.CSSProperties = {
      minHeight: `${webAppData.viewportHeight || window.innerHeight}px`,
      height: "100vh",
      overflow: "hidden auto",
    };

    if (theme === "system") {
      return {
        ...base,
        ["--tg-theme-bg-color" as any]: webAppData.theme.bg_color || "",
        ["--tg-theme-text-color" as any]: webAppData.theme.text_color || "",
      };
    }
    return base;
  }, [theme, webAppData.viewportHeight, webAppData.theme.bg_color, webAppData.theme.text_color]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen safe-area-inset">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-telegram-500 mx-auto" />
          <h2 className="text-lg font-medium">Telegram Channel Marketplace</h2>
          {!isTelegramEnvironment && (
            <p className="text-xs text-muted-foreground mt-2">
              Open via Telegram for full features
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="telegram-mini-app" style={containerStyle}>
      {children}
    </div>
  );
}