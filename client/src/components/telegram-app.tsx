import { ReactNode, useMemo } from "react";
import { useTelegram } from "@/hooks/use-telegram";
import { useTheme } from "@/contexts/theme-context";

export function TelegramApp({ children }: { children: ReactNode }) {
  const { isReady, webAppData, isTelegramEnvironment } = useTelegram();
  const { theme } = useTheme();

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen safe-area-inset">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-telegram-600" />
      </div>
    );
  }

  // مرّر ألوان تيليجرام فقط عندما يكون الاختيار System
  const style = useMemo(() => {
    const base: React.CSSProperties = {
      minHeight: `${webAppData.viewportHeight}px`,
      height: "100vh",
      overflow: "hidden auto",
    };
    if (theme === "system") {
      return {
        ...base,
        // هذه القيم تستخدمها index.css عبر var(--tg-theme-…)
        ["--tg-theme-bg-color" as any]: webAppData.theme.bg_color || "",
        ["--tg-theme-text-color" as any]: webAppData.theme.text_color || "",
      };
    }
    // في الوضع اليدوي: لا نمرر قيم تيليجرام
    return base;
  }, [theme, webAppData]);

  return (
    <div className="telegram-mini-app" style={style}>
      {children}
      {!isTelegramEnvironment && (
        <div className="p-3 text-center text-xs text-muted-foreground">
          Tip: open via Telegram for best theming.
        </div>
      )}
    </div>
  );
}