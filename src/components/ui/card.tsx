import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type CardTone = "default" | "mint" | "apricot" | "lavender" | "sky" | "periwinkle";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
}

const toneClasses: Record<CardTone, string> = {
  default: "bg-snow",
  mint: "bg-mint/40",
  apricot: "bg-apricot/15",
  lavender: "bg-lavender",
  sky: "bg-sky/50",
  periwinkle: "bg-periwinkle",
};

export function Card({ className, tone = "default", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card p-6 shadow-[var(--shadow-card)] transition-[background-color,box-shadow] duration-200 hover:shadow-[var(--shadow-card-hover)]",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
