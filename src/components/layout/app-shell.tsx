"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MobileNav } from "@/components/navigation/mobile-nav";
import Icon from "@/components/ui/icon-material";

const links = [
  { href: "/dashboard", label: "Inicio", name: "grid_on" },
  { href: "/analytics", label: "Análisis", name: "bar_chart" },
  { href: "/transactions", label: "Movimientos", name: "receipt_long" },
  { href: "/debts", label: "Deudas", name: "credit_card" },
  { href: "/settings", label: "Más", name: "settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.10),_transparent_55%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-40 pb-safe pt-5 pt-safe sm:px-6 lg:flex-row lg:px-8 lg:pb-8">
        <aside className="hidden w-72 shrink-0 rounded-[32px] border border-slate-200/70 bg-white/85 p-5 shadow-xl shadow-slate-200/40 backdrop-blur md:flex md:flex-col">
          <div className="flex items-center gap-3 rounded-3xl border border-slate-200/70 bg-slate-50/90 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-200 text-slate-900">
              <Icon name="account_balance_wallet" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Northstar</p>
              <p className="text-xs text-slate-500">Finanzas premium</p>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {links.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition " +
                    (isActive
                      ? "bg-slate-200 text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                  }
                >
                  <Icon name={item.name} className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

        </aside>

        <div className="flex-1 lg:pl-6">
          <div className="min-h-full">
            {children}
          </div>
        </div>
      </div>

      <MobileNav className="lg:hidden" />
    </div>
  );
}

