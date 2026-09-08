"use client";

import { useEffect } from "react";

/**
 * Registra el service worker solo en producción: en `next dev` el caching
 * agresivo de un SW interfiere con HMR y sirve código viejo.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("No se pudo registrar el service worker", err);
    });
  }, []);

  return null;
}
