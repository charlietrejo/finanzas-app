import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type BillStyle = CSSProperties & { "--bl-tilt": string };

/**
 * Loading global tipo "sticker" (Fase 9 del doc: loading global para
 * navegación entre pestañas y reemplazo del skeleton en cargas más largas —
 * ver src/components/ui/route-loading.tsx, que decide cuándo mostrar esto en
 * vez del Skeleton). Puro SVG + CSS keyframes (sin librerías nuevas): cada
 * billete es el mismo <BillSvg>, posicionado y temporizado por
 * BILLS (denominación, offset horizontal, tilt final, delay) — nunca
 * Math.random() en render, porque esto se sirve desde un Server Component
 * (loading.tsx) y un valor distinto en cada render de servidor/cliente
 * rompería la hidratación (ver la sesión anterior: exactamente ese tipo de
 * bug ya pasó con otro componente). Con 4 billetes, 4.8s de ciclo y 1.2s de
 * stagger, cada billete es visible ~75% de su propio ciclo — bastante más
 * que el stagger entre uno y el siguiente — así que siempre hay al menos uno
 * en pantalla.
 */

const BILLS: { denom: 20 | 50 | 100 | 200; left: string; tilt: number; delay: string }[] = [
  { denom: 20, left: "12%", tilt: -10, delay: "0s" },
  { denom: 50, left: "36%", tilt: 7, delay: "1.2s" },
  { denom: 100, left: "60%", tilt: -8, delay: "2.4s" },
  { denom: 200, left: "82%", tilt: 9, delay: "3.6s" },
];

function BillSvg({ denom }: { denom: 20 | 50 | 100 | 200 }) {
  return (
    <svg viewBox="0 0 120 64" width="72" height="38" aria-hidden="true">
      <rect x="2" y="2" width="116" height="60" rx="10" fill="#534AB7" stroke="#26215C" strokeWidth="4" />
      <rect x="9" y="9" width="102" height="46" rx="7" fill="#7f77dd" />
      <rect
        x="16"
        y="16"
        width="88"
        height="32"
        rx="4"
        fill="none"
        stroke="#26215C"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
      <circle cx="42" cy="32" r="12" fill="#f5f6f8" stroke="#26215C" strokeWidth="2" />
      <text x="42" y="37" textAnchor="middle" fontSize="15" fontWeight="700" fill="#26215C">
        $
      </text>
      <text x="105" y="20" textAnchor="end" fontSize="12" fontWeight="700" fill="#26215C">
        {denom}
      </text>
    </svg>
  );
}

export function LoadingBills({ className, label = "Cargando…" }: { className?: string; label?: string }) {
  return (
    <div
      className={cn("bl-container relative h-40 w-full overflow-hidden", className)}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
      {BILLS.map((b) => (
        <div
          key={b.denom}
          className="bl-bill absolute bottom-[8%]"
          style={{ left: b.left, animationDelay: b.delay, "--bl-tilt": `${b.tilt}deg` } as BillStyle}
        >
          <BillSvg denom={b.denom} />
        </div>
      ))}

      <style>{`
        /* Distancias en px, no %: % en translateY es relativo a la altura
           del propio billete (38px), no del contenedor (h-40 = 160px) —
           con % el billete quedaba clippeado por overflow-hidden bastante
           antes de llegar a opacity:0, así que el desvanecido pasaba fuera
           de vista. Estos valores están calibrados para el h-40 de abajo. */
        @keyframes bl-rise {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 0; }
          8% { opacity: 1; }
          18% { transform: translateY(-24px) rotate(calc(var(--bl-tilt) * 0.4)) scale(1); opacity: 1; }
          70% { transform: translateY(-110px) rotate(var(--bl-tilt)) scale(0.88); opacity: 1; }
          100% { transform: translateY(-170px) rotate(calc(var(--bl-tilt) * 1.3)) scale(0.7); opacity: 0; }
        }
        .bl-bill {
          animation: bl-rise 4.8s ease-in-out infinite;
          will-change: transform, opacity;
        }
        /* Fase 9: fallback estático — la regla global en globals.css ya
           fuerza animation-duration a 0.01ms para todo (*, *::before,
           *::after), pero eso solo dejaría los billetes congelados a medio
           camino (casi transparentes, a medio subir). Aquí se apaga la
           animación del todo y se muestran completos y quietos — la
           "versión estática" que pide el doc, no un parpadeo de 0.01ms. */
        @media (prefers-reduced-motion: reduce) {
          .bl-bill {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
