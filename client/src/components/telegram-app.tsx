// client/src/components/telegram-app.tsx
import { ReactNode } from "react";
import { useTelegram } from "@/hooks/use-telegram";
import { useTheme } from "@/contexts/theme-context";

export function TelegramApp({ children }: { children: ReactNode }) {
  const { isReady, webAppData, isTelegramEnvironment } = useTelegram();
  const { theme } = useTheme();

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen safe-area-inset">
        {/* ...loading... */}
      </div>
    );
  }

  const style =
    theme === "system"
      ? ({
          "--tg-theme-bg-color": webAppData.theme.bg_color || "",
          "--tg-theme-text-color": webAppData.theme.text_color || "",
          minHeight: `${webAppData.viewportHeight}px`,
          height: "100vh",
          overflow: "hidden auto",
        } as React.CSSProperties)
      : ({
          minHeight: `${webAppData.viewportHeight}px`,
          height: "100vh",
          overflow: "hidden auto",
        } as React.CSSProperties);

  return (
    <div className="telegram-mini-app" style={style}>
      {children}
    </div>
  );
}