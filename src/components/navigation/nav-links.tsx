"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, ArrowLeftRight, PiggyBank, CreditCard, Target, BarChart3, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Cuentas", icon: Wallet },
  { href: "/transactions", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/budgets", label: "Presupuestos", icon: PiggyBank },
  { href: "/debts", label: "Deudas", icon: CreditCard },
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  // Ruta "/profile", no "/account": "/accounts".startsWith("/account") sería
  // true y el activo de esta pestaña se prendería también en Cuentas.
  { href: "/profile", label: "Cuenta", icon: User },
];

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet";

/**
 * Concatenación plana en vez de cn()/twMerge a propósito: este componente
 * vive en el layout persistente (se renderiza en cada carga completa de
 * cualquier ruta) y ninguna de estas clases compite entre sí (no hay nada
 * que twMerge necesite deduplicar), así que cn() aquí era pura conveniencia,
 * no necesidad — se quita porque en una sesión anterior se reportó un
 * mismatch de hidratación en el className de estos mismos enlaces
 * (servidor y cliente difiriendo en qué clases traía la cadena fusionada).
 * Con concatenación directa no hay fusión que pueda divergir entre entornos.
 */
export function NavLinks({ orientation }: { orientation: "horizontal" | "vertical" }) {
  const pathname = usePathname();
  const isHorizontal = orientation === "horizontal";

  return (
    <nav className={isHorizontal ? "flex items-center gap-1 overflow-x-auto px-1" : "flex flex-col gap-1"}>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        const layoutClasses = isHorizontal
          ? "flex min-w-[74px] shrink-0 flex-col items-center gap-1 px-1 py-2 text-[11px] leading-tight"
          : "flex items-center gap-3 rounded-badge px-4 py-2.5 text-sm";
        const stateClasses = active
          ? isHorizontal
            ? "text-violet-text"
            : "bg-periwinkle text-violet-text font-medium"
          : "text-slate hover:text-ink";

        return (
          <Link key={href} href={href} className={`${FOCUS_RING} ${layoutClasses} ${stateClasses}`}>
            <Icon size={isHorizontal ? 23 : 18} />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
