import Link from "next/link";
import { ArrowRightLeft, BarChart3, CircleDollarSign, Goal, LayoutGrid, ListChecks, Settings, Wallet2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/navigation/mobile-nav";

const links = [
  { href: "/dashboard", label: "Inicio", icon: LayoutGrid },
  { href: "/analytics", label: "Análisis", icon: BarChart3 },
  { href: "/transactions", label: "Movimientos", icon: ListChecks },
  { href: "/goals", label: "Metas", icon: Goal },
  { href: "/settings", label: "Más", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_60%)] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-24 pt-5 sm:px-6 lg:flex-row lg:px-8 lg:pb-8">
        <aside className="hidden w-72 shrink-0 rounded-[28px] border border-slate-200/70 bg-white/80 p-5 shadow-sm shadow-slate-200/60 backdrop-blur md:flex md:flex-col dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-800/70">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950">
              <Wallet2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Northstar</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Finanzas premium</p>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {links.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[24px] border border-emerald-200/70 bg-emerald-50/80 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/60">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              <CircleDollarSign className="h-4 w-4" />
              Gestor de finanzas
            </div>
            <p className="mt-2 text-sm text-emerald-700/80 dark:text-emerald-400/80">
              Arquitectura preparada para Supabase, RLS, PWA y futuro Capacitor.
            </p>
            <Button className="mt-4 w-full" variant="secondary">
              <ArrowRightLeft className="h-4 w-4" />
              Transferir
            </Button>
          </div>
        </aside>

        <div className="flex-1 lg:pl-6">
          <div className="rounded-[28px] border border-slate-200/70 bg-white/70 p-3 shadow-sm shadow-slate-200/60 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            {children}
          </div>
        </div>
      </div>

      <MobileNav className="lg:hidden" />
    </div>
  );
}
