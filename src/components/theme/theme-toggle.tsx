"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * `initialTheme` viene resuelto del servidor (cookie `theme`, ver
 * src/app/(app)/layout.tsx) para que el ícono ya salga correcto en la
 * mayoría de las cargas. El inicializador perezoso de useState (no un
 * efecto — evita relanzar un render extra) relee el `data-theme` real del
 * `<html>` en el primer render del cliente, que ya puede diferir de
 * `initialTheme` en una primera visita sin cookie (ahí decidió el script
 * inline de src/app/layout.tsx por `prefers-color-scheme`) —
 * `suppressHydrationWarning` en el botón cubre ese único caso borde.
 */
export function ThemeToggle({ initialTheme }: { initialTheme: "light" | "dark" }) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return initialTheme;
    const current = document.documentElement.getAttribute("data-theme");
    return current === "light" || current === "dark" ? current : initialTheme;
  });

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `theme=${next};path=/;max-age=31536000;SameSite=Lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      suppressHydrationWarning
      aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-badge text-slate transition-colors hover:bg-pebble/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
