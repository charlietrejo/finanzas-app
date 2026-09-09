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
  // red-500 (bg-red-500) sobre texto blanco da 3.76:1, por debajo de AA
  // (4.5:1) — red-600 da 4.83:1, red-700 6.47:1. Un solo par funciona en
  // ambos modos (el rojo ya es lo bastante oscuro para leerse sobre fondo
  // oscuro sin necesitar una variante dark: aparte).
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
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
