"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * <img> compartida por BankLogo/MerchantLogo (sección 3.8, Logo.dev). Sin
 * token configurado, o si la imagen falla al cargar, no renderiza nada — el
 * nombre en texto que la acompaña en cada pantalla sigue siendo la fuente
 * de verdad, el logo es solo decorativo/identificador.
 */
export function LogoImage({
  src,
  alt,
  size = 20,
  className,
}: {
  src: string | null;
  alt: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- dominio externo (img.logo.dev), sin next/image config en esta rama de prueba
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn("inline-block shrink-0 rounded-full bg-white object-contain", className)}
    />
  );
}
