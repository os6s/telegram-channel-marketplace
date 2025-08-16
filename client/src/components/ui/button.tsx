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
        // سيُستخدم فقط عند theme === "system"
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
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  hapticFeedback?: Haptic;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, hapticFeedback = "medium", onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const { hapticFeedback: tgHaptic } = useTelegram();
    const { theme } = useTheme();
    const isSystem = theme === "system";

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      try {
        if (tgHaptic) {
          if (hapticFeedback === "success" || hapticFeedback === "error") {
            tgHaptic.notification?.(hapticFeedback as any);
          } else if (hapticFeedback === "selection") {
            tgHaptic.selection?.();
          } else {
            tgHaptic.impact?.(hapticFeedback as any);
          }
        }
      } catch {}
      onClick?.(e);
    };

    // لو المستخدم اختار Light/Dark يدويًا، نتجاهل telegram-styles ونستخدم default
    const effectiveVariant =
      variant === "telegram" && !isSystem ? "default" : (variant ?? "default");

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant: effectiveVariant, size, className }))}
        onClick={handleClick}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };