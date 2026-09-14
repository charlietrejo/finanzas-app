"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wallet, CreditCard, BarChart3, Plus } from "lucide-react";

// Sección 3.6.1 del doc ("Navegación principal, rediseño estilo TikTok"):
// el menú inferior pasa de listar todas las pantallas a 4 íconos + 1 botón
// central. Transacciones/Presupuestos/Metas/Cuenta ya no tienen ícono
// propio aquí — se llega a ellas por el avatar (esquina superior, ver
// layout.tsx) → accesos directos dentro de Cuenta, o por los "Ver más" del
// Dashboard.
const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/accounts", label: "Cuentas", icon: Wallet },
];
const ITEMS_RIGHT = [
  { href: "/debts", label: "Deudas", icon: CreditCard },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
];

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet";
const ITEM_CLASS =
  "flex min-w-[64px] flex-1 shrink-0 flex-col items-center gap-1 px-1 py-2 text-[11px] leading-tight";

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Wallet; active: boolean }) {
  return (
    <Link href={href} className={`${FOCUS_RING} ${ITEM_CLASS} ${active ? "text-violet-text" : "text-slate hover:text-ink"}`}>
      <Icon size={23} />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

export function MobileNavBar() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center px-1">
      {ITEMS.map((item) => (
        <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
      ))}

      <div className="flex flex-1 shrink-0 items-center justify-center">
        {/* Botón central (sección 3.6.1 del doc): no navega a ninguna
            pantalla — abre directo el formulario de nuevo movimiento en
            Movimientos (?new=1, ver transactions-client.tsx) sin pasar por
            la lista intermedia. -mt-6 lo levanta sobre la barra, al estilo
            TikTok. */}
        <Link
          href="/transactions?new=1"
          aria-label="Nuevo movimiento"
          className={`${FOCUS_RING} -mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-monday-violet text-white shadow-[var(--shadow-card)] transition-transform active:scale-95`}
        >
          <Plus size={28} />
        </Link>
      </div>

      {ITEMS_RIGHT.map((item) => (
        <NavItem key={item.href} {...item} active={pathname.startsWith(item.href)} />
      ))}
    </nav>
  );
}
