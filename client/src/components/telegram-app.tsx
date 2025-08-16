import { ReactNode, useEffect, useState } from "react";
import { useTelegram } from "@/hooks/use-telegram";

interface TelegramAppProps {
  children: ReactNode;
}

export function TelegramApp({ children }: TelegramAppProps) {
  const { isReady, webAppData, isTelegramEnvironment } = useTelegram();
  const [isForced, setIsForced] = useState(false);

  // Compute "force-theme" after mount to avoid SSR/early access issues
  useEffect(() => {
    setIsForced(document.documentElement.classList.contains("force-theme"));
  }, []);

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

  const theme = webAppData?.theme || {};
  const style: React.CSSProperties = {
    // Only use Telegram-provided colors when NOT forcing a manual theme
    ...(isForced ? {} : {
      ["--tg-theme-bg-color" as any]: theme.bg_color || "",
      ["--tg-theme-text-color" as any]: theme.text_color || "",
    }),
    minHeight: `${webAppData?.viewportHeight || 0}px`,
    height: "100vh",
    overflow: "hidden auto",
  };

  return (
    <div className="telegram-mini-app" style={style}>
      {children}
    </div>
  );
}