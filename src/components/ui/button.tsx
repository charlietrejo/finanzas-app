import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-sky-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20 hover:from-sky-600 hover:to-fuchsia-600",
        secondary:
          "bg-white text-slate-900 hover:bg-slate-100",
        outline:
          "border border-slate-200 bg-transparent text-slate-900 hover:bg-slate-50",
        ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-5",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };

