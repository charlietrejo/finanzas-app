import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          // text-base (16px) a propósito: por debajo de 16px, iOS Safari hace
          // zoom automático al enfocar el input y el usuario tiene que alejar
          // manualmente — con 16px+ no dispara ese zoom.
          "w-full rounded-badge border border-mist bg-snow px-4 py-2.5 text-base text-ink placeholder:text-slate/50 transition-colors focus:outline-none focus:ring-2 focus:ring-monday-violet/60 disabled:opacity-50 md:text-sm",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("mb-1 block text-sm font-medium text-slate", className)} {...props} />
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full rounded-badge border border-mist bg-snow px-4 py-2.5 text-base text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-monday-violet/60 disabled:opacity-50 md:text-sm",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";
