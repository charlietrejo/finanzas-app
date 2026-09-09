"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// 600ms era invisible en la práctica: con Supabase local, la mayoría de
// las cargas reales (no servidas desde el router cache de Next, que salta
// este fallback por completo) tardan 200-900ms — casi nunca llegaban a los
// 600ms antes de que el contenido real reemplazara el fallback completo,
// así que ni el skeleton alcanzaba a cambiar al spinner. 150ms cubre la
// gran mayoría de esas cargas reales sin parpadear en las casi-instantáneas
// sí servidas desde caché.
const SWAP_TO_LOADER_MS = 150;

/**
 * Envoltura de cada `loading.tsx` de ruta (Fase 9 del doc): un Suspense
 * fallback que dure menos de SWAP_TO_LOADER_MS solo alcanza a mostrar el
 * skeleton de esa pantalla (igual que antes); uno que tarde más (carga
 * "larga" de verdad) cambia al spinner — mismo componente en las 7 rutas,
 * así que también sirve como indicador consistente de navegación entre
 * pestañas. `"use client"` porque necesita un timer; el skeleton sigue
 * siendo Server-renderable, se pasa ya armado por cada loading.tsx.
 *
 * Nota: una ruta ya visitada en la sesión se sirve desde el router cache de
 * Next.js casi instantáneo, SIN pasar por este fallback en absoluto — es
 * comportamiento normal de Next (evita loaders innecesarios en navegación
 * ya cacheada), no un bug de este componente. Para ver el spinner de forma
 * confiable: DevTools → Network → Throttling "Slow 4G" → navega a una
 * pestaña, o refresca (F5) una ruta.
 */
export function RouteLoading({ skeleton }: { skeleton: ReactNode }) {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(true), SWAP_TO_LOADER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (showLoader) return <LoadingSpinner />;
  return <>{skeleton}</>;
}
