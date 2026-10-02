export interface Bank {
  name: string;
  color: string;
  // Dominio usado para buscar el logo real vía Logo.dev (sección 3.8 del doc
  // de requerimientos) — GET https://img.logo.dev/{domain}. Uso nominativo
  // únicamente (identificación visual), sin afiliación ni patrocinio.
  domain: string;
}

// Catálogo visual (sin integración real a los bancos), sección 3.8 del doc de requerimientos.
export const MEXICAN_BANKS: Bank[] = [
  { name: "BBVA", color: "#004481", domain: "bbva.mx" },
  { name: "Santander", color: "#EC0000", domain: "santander.com.mx" },
  { name: "Banorte", color: "#E30513", domain: "banorte.com" },
  { name: "Citibanamex", color: "#00447C", domain: "banamex.com" },
  { name: "HSBC", color: "#DB0011", domain: "hsbc.com.mx" },
  { name: "Scotiabank", color: "#EC111A", domain: "scotiabank.com.mx" },
  { name: "Inbursa", color: "#00629B", domain: "inbursa.com" },
  { name: "Banco Azteca", color: "#00A651", domain: "bancoazteca.com.mx" },
  { name: "BanBajío", color: "#00549F", domain: "bb.com.mx" },
  { name: "Banregio", color: "#8DC63F", domain: "banregio.com" },
  // El dominio raíz "gob.mx" es rechazado por Logo.dev como dominio
  // inválido (lo trata como sufijo público, no como marca) — hay que usar
  // el subdominio propio del banco, que sí tiene logo real indexado.
  { name: "Banco del Bienestar", color: "#8B2942", domain: "bienestar.gob.mx" },
  { name: "Nu México", color: "#820AD1", domain: "nu.com.mx" },
  { name: "Klar", color: "#111827", domain: "klar.mx" },
  { name: "Hey Banco", color: "#00E0B8", domain: "heybanco.com" },
  // Sección 3.8 actualizada: ya emite tarjeta de crédito propia en México.
  { name: "Mercado Pago", color: "#00AAE8", domain: "mercadopago.com.mx" },
];
