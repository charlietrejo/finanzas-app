"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const TEXT_INPUT_TAGS = new Set(["INPUT", "TEXTAREA"]);

function isTextField(el: Element | null): boolean {
  return !!el && TEXT_INPUT_TAGS.has(el.tagName);
}

/**
 * Oculta el nav mientras el teclado de iOS está abierto, en vez de tratar
 * de seguir el movimiento del viewport con `window.visualViewport`
 * (intentado antes, en `sticky-bottom.tsx` — Safari actualiza
 * `visualViewport.offsetTop` tarde/inconsistente durante la animación del
 * teclado, así que el nav seguía quedando mal posicionado un momento).
 * Esta ruta es más robusta: no hay nada que reposicionar porque no está
 * visible. Detecta foco en cualquier <input>/<textarea> vía
 * focusin/focusout delegado en `document` — no hace falta instrumentar
 * cada campo del código.
 */
export function HideOnKeyboard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    function handleFocusIn(e: FocusEvent) {
      if (isTextField(e.target as Element)) setHidden(true);
    }
    function handleFocusOut() {
      // Al tabular entre dos campos, el focusout del primero dispara antes
      // que el focusin del segundo — sin este delay habría un parpadeo del
      // nav reapareciendo un instante entre campo y campo.
      setTimeout(() => {
        if (!isTextField(document.activeElement)) setHidden(false);
      }, 50);
    }
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  return (
    <div
      className={cn("transition-transform duration-200", hidden && "translate-y-full", className)}
      style={style}
      aria-hidden={hidden}
      inert={hidden || undefined}
    >
      {children}
    </div>
  );
}
