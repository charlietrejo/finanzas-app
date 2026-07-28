"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.10),_transparent_55%)] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-24 pt-5 sm:px-6 lg:flex-row lg:px-8 lg:pb-8">
        <aside className="hidden w-72 shrink-0 rounded-[32px] border border-slate-200/70 bg-white/85 p-5 shadow-xl shadow-slate-200/40 backdrop-blur md:flex md:flex-col dark:border-slate-800 dark:bg-slate-950/75">
          <div className="flex items-center gap-3 rounded-3xl border border-slate-200/70 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950">
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
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition " +
                    (isActive
                      ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-[28px] border border-violet-200/70 bg-violet-50/80 p-4 dark:border-violet-900/60 dark:bg-violet-950/60">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-300">
              <CircleDollarSign className="h-4 w-4" />
              Gestor de finanzas
            </div>
            <p className="mt-2 text-sm text-violet-700/80 dark:text-violet-400/80">
              Arquitectura lista para Supabase, RLS, PWA y futuro Capacitor.
            </p>
            <Button className="mt-4 w-full" variant="secondary">
              <ArrowRightLeft className="h-4 w-4" />
              Transferir
            </Button>
          </div>
        </aside>

        <div className="flex-1 lg:pl-6">
          <div className="rounded-[32px] border border-slate-200/70 bg-white/85 p-4 shadow-xl shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-950/75">
            {children}
          </div>
        </div>
      </div>

      <MobileNav className="lg:hidden" />
    </div>
  );
}
