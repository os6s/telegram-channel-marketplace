import { useTelegram } from "@/hooks/use-telegram";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface MiniAppHeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

export function MiniAppHeader({ title, showBackButton, onBackClick }: MiniAppHeaderProps) {
  const { hapticFeedback, backButton } = useTelegram();
  const [, setLocation] = useLocation();

  const handleBackClick = () => {
    hapticFeedback.impact('light');
    
    if (onBackClick) {
      onBackClick();
    } else {
      // Default back navigation
      setLocation('/');
    }
  };

  // Use Telegram's native back button if available
  if (showBackButton && window.Telegram?.WebApp?.BackButton) {
    backButton.show(handleBackClick);
  }

  if (!title && !showBackButton) return null;

  return (
    <div className="flex items-center justify-between p-4 bg-background border-b border-border safe-area-inset">
      <div className="flex items-center space-x-3">
        {showBackButton && !window.Telegram?.WebApp?.BackButton && (
          <button
            onClick={handleBackClick}
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors touch-target haptic-feedback"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        {title && (
          <h1 className="text-lg font-semibold truncate">{title}</h1>
        )}
      </div>
    </div>
  );
}