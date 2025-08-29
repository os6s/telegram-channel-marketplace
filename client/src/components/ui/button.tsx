// client/src/components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useTelegram } from "@/hooks/use-telegram";
import { useTheme } from "@/contexts/theme-context";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        telegram: "telegram-button haptic-feedback touch-target",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

type Haptic = "light" | "medium" | "heavy" | "success" | "error" | "selection";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  hapticFeedback?: Haptic;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      hapticFeedback = "medium",
      onClick,
      type, // سنضبط افتراضيًا "button" إذا لم يُمرَّر
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const { hapticFeedback: tgHaptic } = useTelegram();
    const { theme } = useTheme();
    const isSystem = theme === "system";

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      try {
        // شغّل الهابتك فقط داخل Telegram WebApp إذا API متوفّر
        if (tgHaptic && (window as any)?.Telegram?.WebApp) {
          switch (hapticFeedback) {
            case "success":
            case "error":
              tgHaptic.notification?.(hapticFeedback);
              break;
            case "selection":
              tgHaptic.selection?.();
              break;
            default:
              tgHaptic.impact?.(hapticFeedback);
          }
        }
      } catch {
        // تجاهل أخطاء الهابتك نهائيًا
      }
      onClick?.(e);
    };

    // عند اختيار "system" نسمح باستخدام مظهر Telegram، خلافه نرجع للـ default
    const effectiveVariant =
      variant === "telegram" && !isSystem ? "default" : (variant ?? "default");

    return (
      <Comp
        ref={ref as any}
        // type افتراضيًا "button" لتجنب submit غير مقصود داخل فورم
        {...(Comp === "button" ? { type: (type as any) || "button" } : {})}
        className={cn(buttonVariants({ variant: effectiveVariant, size, className }))}
        onClick={handleClick}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };