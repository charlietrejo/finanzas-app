import Link from "next/link";
import { BarChart3, Goal, LayoutGrid, ListChecks, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Inicio", icon: LayoutGrid },
  { href: "/analytics", label: "Análisis", icon: BarChart3 },
  { href: "/transactions", label: "Agregar", icon: ListChecks, primary: true },
  { href: "/goals", label: "Metas", icon: Goal },
  { href: "/settings", label: "Más", icon: Settings },
];

export function MobileNav({ className }: { className?: string }) {
  return (
    <nav className={cn("fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/70 bg-white/90 px-2 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90", className)}>
      <div className="mx-auto flex max-w-md items-center justify-between gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-medium text-slate-600 transition dark:text-slate-300",
                item.primary && "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950",
              )}
            >
              <Icon className="mb-1 h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
