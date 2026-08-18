"use client";

import { useEffect, useRef, useState } from "react";

import { formatMoney } from "@/lib/format";

// QA-37 — Isla interactiva mínima: anima el contador de "dinero disponible"
// cuando React hidrata. Si la hidratación está bloqueada por CSP (scripts RSC
// inline), el valor final se muestra igualmente porque el Server Component
// renderiza el mismo formatMoney(target) como fallback inicial. No depende de
// datos externos: recibe `target` como prop desde el Server Component.
export function AnimatedMoney({
  target,
  className,
}: {
  target: number;
  className?: string;
}) {
  const [value, setValue] = useState(target);
  const rafRef = useRef(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      queueMicrotask(() => setValue(target));
      return;
    }

    const durationMs = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return <span className={className}>{formatMoney(value)}</span>;
}
