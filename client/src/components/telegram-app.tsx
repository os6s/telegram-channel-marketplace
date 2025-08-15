import { ReactNode } from "react";
import { useTelegram } from "@/hooks/use-telegram";

interface TelegramAppProps {
  children: ReactNode;
}

export function TelegramApp({ children }: TelegramAppProps) {
  const { isReady, webAppData, isTelegramEnvironment } = useTelegram();

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen safe-area-inset">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-telegram-500 mx-auto"></div>
          <h2 className="text-lg font-medium">Telegram Channel Marketplace</h2>
          <p className="text-sm text-muted-foreground">Loading your marketplace...</p>
          {!isTelegramEnvironment && (
            <p className="text-xs text-muted-foreground mt-4">
              For the best experience, open this app through Telegram
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="telegram-mini-app"
      style={
        {
          "--tg-theme-bg-color": webAppData.theme.bg_color || "",
          "--tg-theme-text-color": webAppData.theme.text_color || "",
          minHeight: `${webAppData.viewportHeight}px`,
          height: "100vh",
          overflow: "hidden auto",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}