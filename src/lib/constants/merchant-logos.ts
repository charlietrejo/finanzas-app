/**
 * Fuente del logo real de cada comercio del catálogo (sección 3.8) para
 * Logo.dev. A diferencia de los bancos (siempre dominio), aquí algunos
 * comercios no tienen logo indexado por dominio pero sí por nombre
 * (`kind: "name"`, endpoint `img.logo.dev/name/{value}`) — probado caso por
 * caso contra la API real, ver notas de la rama feature/bank-logos.
 */
export interface MerchantLogoSource {
  kind: "domain" | "name";
  value: string;
}

export const MERCHANT_LOGO_SOURCES: Record<string, MerchantLogoSource> = {
  Walmart: { kind: "domain", value: "walmart.com.mx" },
  Soriana: { kind: "domain", value: "soriana.com" },
  Chedraui: { kind: "domain", value: "chedraui.com.mx" },
  "La Comer": { kind: "domain", value: "lacomer.com.mx" },
  "Bodega Aurrerá": { kind: "domain", value: "bodegaaurrera.com.mx" },
  Oxxo: { kind: "domain", value: "oxxo.com" },
  "7-Eleven": { kind: "domain", value: "7-eleven.com.mx" },
  Extra: { kind: "domain", value: "extra.com.mx" },
  "Farmacias del Ahorro": { kind: "domain", value: "fahorro.com.mx" },
  "Farmacias Guadalajara": { kind: "domain", value: "farmaciasguadalajara.com" },
  Similares: { kind: "domain", value: "farmaciasdesimilares.com" },
  Rappi: { kind: "domain", value: "rappi.com" },
  "Uber Eats": { kind: "domain", value: "ubereats.com" },
  "Didi Food": { kind: "domain", value: "didi-food.com" },
  Uber: { kind: "domain", value: "uber.com" },
  Didi: { kind: "domain", value: "didiglobal.com" },
  "Metro/Metrobús": { kind: "domain", value: "metrobus.cdmx.gob.mx" },
  Netflix: { kind: "domain", value: "netflix.com" },
  Spotify: { kind: "domain", value: "spotify.com" },
  "Disney+": { kind: "domain", value: "disneyplus.com" },
  "Amazon Prime": { kind: "domain", value: "amazon.com" },
  Telcel: { kind: "domain", value: "telcel.com" },
  "AT&T México": { kind: "domain", value: "att.com.mx" },
  Movistar: { kind: "domain", value: "movistar.com.mx" },
  // Ningún dominio probado (izzi.mx, izzi.com.mx, izzitelecom.com.mx) tiene
  // logo indexado en Logo.dev (404 incluso con fallback=404) — solo la
  // búsqueda por nombre ("name/izzi") sí lo encuentra.
  Izzi: { kind: "name", value: "izzi" },
  Totalplay: { kind: "domain", value: "totalplay.com.mx" },
};
