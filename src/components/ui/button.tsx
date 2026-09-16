import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-monday-violet text-white hover:bg-monday-violet/90 disabled:bg-monday-violet/50",
  outline:
    "bg-transparent text-slate border border-slate hover:bg-slate/5 disabled:opacity-50",
  ghost: "bg-transparent text-slate hover:bg-pebble/40 disabled:opacity-50",
  // --color-danger (red-600) sobre texto blanco da 4.83:1, sobre AA — fijo
  // en ambos modos, igual que bg-monday-violet, así que no necesita una
  // variante dark: aparte (ver globals.css).
  danger: "bg-danger text-white hover:bg-danger/90 disabled:bg-danger/50",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-pill px-6 py-3 font-medium text-sm transition-colors transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet focus-visible:ring-offset-2 focus-visible:ring-offset-cloud",
          variantClasses[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
