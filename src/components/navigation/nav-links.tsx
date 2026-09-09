"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, ArrowLeftRight, PiggyBank, CreditCard, Target, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Cuentas", icon: Wallet },
  { href: "/transactions", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/budgets", label: "Presupuestos", icon: PiggyBank },
  { href: "/debts", label: "Deudas", icon: CreditCard },
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
];

export function NavLinks({ orientation }: { orientation: "horizontal" | "vertical" }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        orientation === "horizontal"
          ? "flex items-center gap-1 overflow-x-auto px-1"
          : "flex flex-col gap-1"
      )}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet",
              orientation === "horizontal"
                ? "flex min-w-[74px] shrink-0 flex-col items-center gap-1 px-1 py-2 text-[11px] leading-tight"
                : "flex items-center gap-3 rounded-badge px-4 py-2.5 text-sm",
              active
                ? orientation === "horizontal"
                  ? "text-violet-text"
                  : "bg-periwinkle text-violet-text font-medium"
                : "text-slate hover:text-ink"
            )}
          >
            <Icon size={orientation === "horizontal" ? 23 : 18} />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
