"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISSED_KEY = "northstar-ios-install-hint-dismissed";

/**
 * iOS Safari no dispara `beforeinstallprompt` (eso es solo Chrome/Android),
 * así que la única forma de sugerir instalar la PWA es indicar el paso
 * manual: Compartir → Agregar a pantalla de inicio (sección 5 del doc).
 */
export function IosInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isStandalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const dismissed = localStorage.getItem(DISMISSED_KEY) === "1";

    // Detección de entorno del navegador (no hay forma de leerla en el render
    // ni durante SSR): navigator/localStorage no existen en el servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(isIos && !isStandalone && !dismissed);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="mx-4 mt-4 flex items-center gap-3 rounded-card bg-periwinkle px-4 py-3 text-sm text-ink md:mx-10">
      <Share size={18} className="shrink-0 text-monday-violet" />
      <p className="flex-1">
        Instala Finanzas: toca <strong>Compartir</strong> y luego{" "}
        <strong>Agregar a pantalla de inicio</strong>.
      </p>
      <button aria-label="Cerrar aviso" onClick={dismiss} className="shrink-0 text-slate">
        <X size={16} />
      </button>
    </div>
  );
}
