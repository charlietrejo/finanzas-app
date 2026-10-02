import type { Bank } from "@/lib/constants/banks";
import { MEXICAN_BANKS } from "@/lib/constants/banks";

// Publishable key de Logo.dev (sección 3.8 del doc) — se expone al cliente a
// propósito: es el tipo de token diseñado por Logo.dev para usarse en <img>
// desde el navegador (no es la secret key de su REST API). Pasos de cuenta
// (crear cuenta gratuita, copiar el token) le tocan al usuario, no se pueden
// automatizar aquí.
const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

export function findBankByName(name: string | null | undefined): Bank | undefined {
  if (!name) return undefined;
  return MEXICAN_BANKS.find((b) => b.name === name);
}

/**
 * URL del logo real de un banco vía Logo.dev. `fallback=monogram` (default
 * de su API) hace que, si el dominio no tiene logo indexado, regrese un
 * monograma genérico en vez de romper la imagen — por eso no hay forma de
 * detectar desde el frontend si el logo mostrado es "real" o ese monograma;
 * eso solo se puede juzgar a simple vista una vez que haya token (sección
 * 3.8: "pruébalo contra los 15 bancos").
 */
export function getBankLogoUrl(domain: string, sizePx: number = 64): string | null {
  if (!LOGO_DEV_TOKEN) return null;
  const params = new URLSearchParams({
    token: LOGO_DEV_TOKEN,
    size: String(sizePx),
    retina: "true",
  });
  return `https://img.logo.dev/${domain}?${params.toString()}`;
}
