// client/src/components/telegram-app.tsx
import { type CSSProperties, type ReactNode } from "react";
import { useTelegram } from "@/hooks/use-telegram";
import { useTheme } from "@/contexts/theme-context";

export function TelegramApp({ children }: { children: ReactNode }) {
  const { isReady, webAppData } = useTelegram();
  const { theme } = useTheme();

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen safe-area-inset">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-telegram-500" />
      </div>
    );
  }

  const base: CSSProperties = {
    minHeight: `${webAppData.viewportHeight}px`,
    height: "100vh",
    overflow: "hidden auto",
  };

  // مرّر قيم Telegram فقط في وضع system
  const style: CSSProperties =
    theme === "system"
      ? {
          ...base,
          // تسمح لتيليجرام بالتحكم بالألوان الافتراضية
          ["--tg-theme-bg-color" as any]: webAppData.theme.bg_color || "",
          ["--tg-theme-text-color" as any]: webAppData.theme.text_color || "",
        }
      : base;

  return (
    <div className="telegram-mini-app" style={style}>
      {children}
    </div>
  );
}