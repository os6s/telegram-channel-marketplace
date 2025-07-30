import { ButtonHTMLAttributes, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { useTelegram } from "@/hooks/use-telegram";
import { cn } from "@/lib/utils";

interface EnhancedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "telegram";
  size?: "default" | "sm" | "lg" | "icon";
  hapticFeedback?: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection';
  children: React.ReactNode;
}

export const EnhancedButton = forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({ 
    className, 
    variant = "default", 
    size = "default", 
    hapticFeedback = "medium",
    onClick,
    children,
    ...props 
  }, ref) => {
    const { hapticFeedback: tgHaptic } = useTelegram();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Trigger haptic feedback
      if (hapticFeedback === 'success' || hapticFeedback === 'error') {
        tgHaptic.notification(hapticFeedback as any);
      } else if (hapticFeedback === 'selection') {
        tgHaptic.selection();
      } else {
        tgHaptic.impact(hapticFeedback as any);
      }

      // Call original onClick
      onClick?.(e);
    };

    if (variant === "telegram") {
      return (
        <button
          ref={ref}
          className={cn(
            "telegram-button haptic-feedback touch-target",
            className
          )}
          onClick={handleClick}
          {...props}
        >
          {children}
        </button>
      );
    }

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn("haptic-feedback touch-target", className)}
        onClick={handleClick}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

EnhancedButton.displayName = "EnhancedButton";