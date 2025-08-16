import { ReactNode } from "react";
import { useTelegram } from "@/hooks/use-telegram";
import { useTheme } from "@/contexts/theme-context";

export function TelegramApp({ children }: { children: ReactNode }) {
  const { isReady, webAppData } = useTelegram();
  const { theme } = useTheme();

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen safe-area-inset" />
    );
  }

  // في حالة system فقط نمرّر قيم Telegram
  const style: React.CSSProperties =
    theme === "system"
      ? {
          // نسمح لتليجرام يحدد الخلفية والنص
          ["--tg-theme-bg-color" as any]: webAppData.theme.bg_color || "",
          ["--tg-theme-text-color" as any]: webAppData.theme.text_color || "",
          minHeight: `${webAppData.viewportHeight}px`,
          height: "100vh",
          overflow: "hidden auto",
        }
      : {
          // في الوضع اليدوي نتجاهل قيم Telegram تمامًا
          minHeight: `${webAppData.viewportHeight}px`,
          height: "100vh",
          overflow: "hidden auto",
        };

  return (
    <div className="telegram-mini-app" style={style}>
      {children}
    </div>
  );
}