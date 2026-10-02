import type { Bank } from "@/lib/constants/banks";
import { MEXICAN_BANKS } from "@/lib/constants/banks";
import { MERCHANT_LOGO_SOURCES } from "@/lib/constants/merchant-logos";

// Publishable key de Logo.dev (sección 3.8 del doc) — se expone al cliente a
// propósito: es el tipo de token diseñado por Logo.dev para usarse en <img>
// desde el navegador (no es la secret key de su REST API). Pasos de cuenta
// (crear cuenta gratuita, copiar el token) le tocan al usuario, no se pueden
// automatizar aquí.
const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

/**
 * `bank_name` no es un enum en BD (sigue siendo texto libre, sección 3.8),
 * así que compara sin distinguir mayúsculas ni espacios de más — tolera
 * datos capturados a mano fuera del <select> actual. El caso real que lo
 * motivó (dos tarjetas HSBC, solo una con logo) no era esto: era un
 * `bank_name` NULL en una de las dos (nunca se seleccionó banco al crearla),
 * no una diferencia de texto — ahí no hay nada que "machear", hay que
 * volver a guardar el campo desde Editar.
 */
export function findBankByName(name: string | null | undefined): Bank | undefined {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase();
  return MEXICAN_BANKS.find((b) => b.name.toLowerCase() === normalized);
}

function buildLogoUrl(path: string, sizePx: number): string | null {
  if (!LOGO_DEV_TOKEN) return null;
  const params = new URLSearchParams({
    token: LOGO_DEV_TOKEN,
    size: String(sizePx),
    retina: "true",
  });
  return `https://img.logo.dev/${path}?${params.toString()}`;
}

/**
 * URL del logo real de un banco vía Logo.dev. `fallback=monogram` (default
 * de su API) hace que, si el dominio no tiene logo indexado, regrese un
 * monograma genérico en vez de romper la imagen — por eso no hay forma de
 * detectar desde el frontend si el logo mostrado es "real" o ese monograma;
 * eso solo se puede juzgar a simple vista (sección 3.8: "pruébalo contra
 * los 15 bancos" — ya probado con fallback=404 contra la API real, los 15
 * tienen logo real indexado).
 */
export function getBankLogoUrl(domain: string, sizePx: number = 64): string | null {
  return buildLogoUrl(domain, sizePx);
}

/**
 * URL del logo real de un comercio del catálogo (sección 3.8, extendida a
 * negocios/comercios). A diferencia de los bancos, algunos solo resuelven
 * por nombre y no por dominio (ver MERCHANT_LOGO_SOURCES) — probado contra
 * los ~26 comercios reales del catálogo.
 */
export function getMerchantLogoUrl(merchantName: string | null | undefined, sizePx: number = 64): string | null {
  if (!merchantName) return null;
  const source = MERCHANT_LOGO_SOURCES[merchantName];
  if (!source) return null;
  const path = source.kind === "name" ? `name/${source.value}` : source.value;
  return buildLogoUrl(path, sizePx);
}
