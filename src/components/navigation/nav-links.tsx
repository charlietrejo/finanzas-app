"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, ArrowLeftRight, PiggyBank, CreditCard, Target, BarChart3 } from "lucide-react";

// "Cuenta" (/profile) no vive aquí: es el avatar en la esquina superior de
// todas las pantallas (ver src/app/(app)/layout.tsx, sección 3.6.1/3.7 del
// doc). Sidebar de escritorio sin cambios (lista completa) — el rediseño
// "estilo TikTok" (4 íconos + botón central) es solo del menú inferior
// móvil, ver mobile-nav-bar.tsx.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Cuentas", icon: Wallet },
  { href: "/transactions", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/budgets", label: "Presupuestos", icon: PiggyBank },
  { href: "/debts", label: "Deudas", icon: CreditCard },
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
];

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet";

/**
 * Concatenación plana en vez de cn()/twMerge a propósito (ver sesión
 * anterior: un mismatch de hidratación en el className de estos mismos
 * enlaces, servidor y cliente divergiendo en qué clases traía la cadena
 * fusionada). Sidebar vertical de escritorio únicamente.
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        const stateClasses = active ? "bg-periwinkle text-violet-text font-medium" : "text-slate hover:text-ink";

        return (
          <Link
            key={href}
            href={href}
            className={`${FOCUS_RING} flex items-center gap-3 rounded-badge px-4 py-2.5 text-sm ${stateClasses}`}
          >
            <Icon size={18} />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
