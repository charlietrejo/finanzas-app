"use client";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

/**
 * Fallback de cada `loading.tsx` de ruta (Fase 9 del doc): muestra
 * LoadingSpinner desde el primer momento, para toda navegación — mismo
 * componente en las 7 rutas, así que también sirve como indicador
 * consistente de navegación entre pestañas.
 *
 * Antes alternaba entre un skeleton por pantalla y este spinner tras un
 * timer; se quitó esa rama: el swap sin transición entre dos formas muy
 * distintas (grid de cards vs. caja fija de 160px) se percibía como un
 * salto de layout, no como una animación de carga limpia.
 *
 * Nota: una ruta ya visitada en la sesión se sirve desde el router cache de
 * Next.js casi instantáneo, SIN pasar por este fallback en absoluto — es
 * comportamiento normal de Next (evita loaders innecesarios en navegación
 * ya cacheada), no algo que este componente controle.
 */
export function RouteLoading() {
  return <LoadingSpinner />;
}
