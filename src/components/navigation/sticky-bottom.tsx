"use client";

import { useEffect, useRef } from "react";

/**
 * Safari iOS no soporta `interactive-widget` (ver layout.tsx) ni la
 * VirtualKeyboard API de Chrome — con el teclado abierto, un
 * `position: fixed` sigue anclado al layout viewport completo, no al área
 * realmente visible encima del teclado, y queda "flotando". Lo corrige a
 * mano siguiendo `window.visualViewport` con una `translateY` (técnica
 * estándar para este bug de iOS, sin equivalente nativo en CSS todavía).
 * En navegadores que sí resuelven esto solos, `visualViewport.offsetTop`
 * se queda en 0 y el translateY calculado es 0 — no hace nada distinto.
 */
export function StickyBottom({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    let pending = false;
    const handler = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const el = ref.current;
        if (!el) return;
        const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
        el.style.transform = offset > 0 ? `translateY(-${offset}px)` : "";
      });
    };

    viewport.addEventListener("resize", handler);
    viewport.addEventListener("scroll", handler);
    return () => {
      viewport.removeEventListener("resize", handler);
      viewport.removeEventListener("scroll", handler);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
