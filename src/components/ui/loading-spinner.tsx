import { cn } from "@/lib/utils";

/**
 * Loading global (Fase 9 del doc: para navegación entre pestañas y
 * reemplazo del skeleton en cargas más largas — ver
 * src/components/ui/route-loading.tsx, que decide cuándo mostrar esto en
 * vez del Skeleton). SVG + CSS puro, sin librerías nuevas.
 *
 * Layout con estilos inline (no clases nuevas de Tailwind tipo h-40): en el
 * componente anterior (billetes, ya retirado) `h-40`/`sr-only` no llegaban a
 * generarse en dev — Tailwind/Turbopack no las detectaba viniendo de este
 * archivo aunque el resto de sus clases sí funcionaban — así que el tamaño
 * del contenedor y el texto oculto para lector de pantalla se resuelven acá
 * con style inline / CSS propio, sin depender de su JIT para nada crítico.
 */
const SIZE = 56;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_LENGTH = CIRCUMFERENCE * 0.28;

export function LoadingSpinner({ className, label = "Cargando…" }: { className?: string; label?: string }) {
  return (
    <div
      className={cn("sp-container relative flex w-full items-center justify-center", className)}
      style={{ height: "10rem" }}
      role="status"
      aria-live="polite"
    >
      <span className="sp-sr-only">{label}</span>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#e2e4ea" strokeWidth={STROKE} />
        <circle
          className="sp-arc"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#6161ff"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE - ARC_LENGTH}`}
        />
      </svg>

      <style>{`
        .sp-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }
        @keyframes sp-rotate {
          to { transform: rotate(360deg); }
        }
        .sp-arc {
          transform-origin: 50% 50%;
          animation: sp-rotate 0.9s linear infinite;
        }
        /* Fase 9: bajo prefers-reduced-motion no se congela de golpe a medio
           giro — la regla global de globals.css ya fuerza
           animation-duration a 0.01ms en *, así que hay que ganarle con
           !important + un selector más específico para que esta animación
           de pulso (mucho más lenta y sutil que el giro) sí se reproduzca. */
        @media (prefers-reduced-motion: reduce) {
          .sp-arc {
            animation: sp-pulse 1.6s ease-in-out infinite !important;
            transform: none !important;
          }
        }
        @keyframes sp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
