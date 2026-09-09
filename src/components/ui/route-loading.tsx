"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoadingBills } from "@/components/ui/loading-bills";

const SWAP_TO_LOADER_MS = 600;

/**
 * Envoltura de cada `loading.tsx` de ruta (Fase 9 del doc): un Suspense
 * fallback que dure menos de SWAP_TO_LOADER_MS solo alcanza a mostrar el
 * skeleton de esa pantalla (igual que antes); uno que tarde más (carga
 * "larga" de verdad) cambia al loading animado de billetes — mismo
 * componente en las 7 rutas, así que también sirve como indicador
 * consistente de navegación entre pestañas. `"use client"` porque necesita
 * un timer; el skeleton sigue siendo Server-renderable, se pasa ya armado
 * por cada loading.tsx.
 */
export function RouteLoading({ skeleton }: { skeleton: ReactNode }) {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(true), SWAP_TO_LOADER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (showLoader) return <LoadingBills />;
  return <>{skeleton}</>;
}
