// client/src/components/telegram-app.tsx
import { ReactNode, useMemo } from "react";
import { useTelegram } from "@/hooks/use-telegram";
import { useTheme } from "@/contexts/theme-context";

interface Props { children: ReactNode }

export function TelegramApp({ children }: Props) {
  // ✅ Hooks at top, always called in same order
  const { isReady, webAppData, isTelegramEnvironment } = useTelegram();
  const { theme } = useTheme(); // "light" | "dark" | "system"

  // ✅ Compute styles via useMemo (no extra hooks later)
  const containerStyle = useMemo<React.CSSProperties>(() => {
    const base: React.CSSProperties = {
      minHeight: `${webAppData.viewportHeight || window.innerHeight}px`,
      height: "100vh",
      overflow: "hidden auto",
    };

    // Only follow Telegram colors when user chose "system"
    if (theme === "system") {
      return {
        ...base,
        // expose TG vars as CSS custom props for index.css to consume
        // (undefined values are fine; CSS will fall back)
        ["--tg-theme-bg-color" as any]: webAppData.theme.bg_color || "",
        ["--tg-theme-text-color" as any]: webAppData.theme.text_color || "",
      };
    }
    // In manual light/dark we don’t set TG vars; our CSS overrides take effect.
    return base;
  }, [theme, webAppData.viewportHeight, webAppData.theme.bg_color, webAppData.theme.text_color]);

  // ✅ Early return AFTER hooks are called (safe)
  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen safe-area-inset">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-telegram-500 mx-auto" />
          <h2 className="text-lg font-medium">Telegram Channel Marketplace</h2>
          {!isTelegramEnvironment && (
            <p className="text-xs text-muted-foreground mt-2">Open via Telegram for full features</p>
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