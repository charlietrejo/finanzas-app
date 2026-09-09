"use client";

import { useEffect, useRef, useState } from "react";
import { formatMXN } from "@/lib/format";

/**
 * Cuenta de 0 al valor real al montarse (ej. al abrir el Dashboard), en vez
 * de mostrar la cifra final de golpe. Respeta prefers-reduced-motion.
 */
export function AnimatedAmount({ value, durationMs = 800 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const effectiveDuration = prefersReducedMotion ? 0 : durationMs;
    const start = performance.now();

    function tick(now: number) {
      const progress = effectiveDuration === 0 ? 1 : Math.min((now - start) / effectiveDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs]);

  return <>{formatMXN(display)}</>;
}
