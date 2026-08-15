"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CreditCard, LayoutGrid, ListChecks, Settings } from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Inicio", icon: LayoutGrid },
  { href: "/analytics", label: "Análisis", icon: BarChart3 },
  { href: "/transactions", label: "Mov.", icon: ListChecks, primary: true },
  { href: "/debts", label: "Deudas", icon: CreditCard },
  { href: "/settings", label: "Más", icon: Settings },
];

export function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/70 bg-white/92 px-3 pb-safe pt-3 backdrop-blur", className)}>
      <div className="mx-auto flex max-w-md items-center justify-between gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-semibold transition",
                isActive
                  ? item.primary
                    ? "bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-600 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-slate-200 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100",
                item.primary && "rounded-full"
              )}
              aria-label={item.label}
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
