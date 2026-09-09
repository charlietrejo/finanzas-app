"use client";

import { usePathname } from "next/navigation";

/**
 * Fase 9: fade-in sutil al navegar entre pestañas — el App Router de
 * Next.js no anima transiciones de ruta por defecto. `key={pathname}` fuerza
 * a React a remontar el contenedor en cada cambio de ruta, re-disparando la
 * animación CSS (`.animate-fade-in`, globals.css); `prefers-reduced-motion`
 * ya la neutraliza globalmente, no hace falta condicionarla aquí.
 */
export function RouteFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-in">
      {children}
    </div>
  );
}
