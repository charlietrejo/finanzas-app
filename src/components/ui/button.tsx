import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-monday-violet text-snow hover:bg-monday-violet/90 disabled:bg-monday-violet/50",
  outline:
    "bg-transparent text-slate border border-slate hover:bg-slate/5 disabled:opacity-50",
  ghost: "bg-transparent text-slate hover:bg-pebble/40 disabled:opacity-50",
  danger: "bg-red-500 text-snow hover:bg-red-600 disabled:bg-red-300",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-pill px-6 py-3 font-medium text-sm transition-colors disabled:cursor-not-allowed",
          variantClasses[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
