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
          ? "flex items-center overflow-x-auto"
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
              orientation === "horizontal"
                ? "flex min-w-[68px] shrink-0 flex-col items-center gap-1 py-2 text-xs"
                : "flex items-center gap-3 rounded-badge px-4 py-2.5 text-sm",
              active
                ? orientation === "horizontal"
                  ? "text-monday-violet"
                  : "bg-periwinkle text-monday-violet font-medium"
                : "text-slate hover:text-ink"
            )}
          >
            <Icon size={orientation === "horizontal" ? 20 : 18} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
