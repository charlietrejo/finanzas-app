"use client";

import { useState } from "react";
import type { Bank } from "@/lib/constants/banks";
import { getBankLogoUrl } from "@/lib/logo-dev";
import { cn } from "@/lib/utils";

/**
 * Logo real de un banco (sección 3.8). Sin `NEXT_PUBLIC_LOGO_DEV_TOKEN`
 * configurado, o si la imagen falla al cargar, no renderiza nada — el
 * nombre en texto que la acompaña en cada pantalla sigue siendo la fuente
 * de verdad, el logo es solo decorativo/identificador.
 */
export function BankLogo({ bank, size = 20, className }: { bank?: Bank; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!bank || failed) return null;

  const src = getBankLogoUrl(bank.domain, size * 2);
  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- dominio externo (img.logo.dev), sin next/image config en esta rama de prueba
    <img
      src={src}
      alt={`Logo de ${bank.name}`}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn("inline-block shrink-0 rounded-full bg-white object-contain", className)}
    />
  );
}
