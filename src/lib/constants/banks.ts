export interface Bank {
  name: string;
  color: string;
}

// Catálogo visual (sin integración real a los bancos), sección 3.8 del doc de requerimientos.
export const MEXICAN_BANKS: Bank[] = [
  { name: "BBVA", color: "#004481" },
  { name: "Santander", color: "#EC0000" },
  { name: "Banorte", color: "#E30513" },
  { name: "Citibanamex", color: "#00447C" },
  { name: "HSBC", color: "#DB0011" },
  { name: "Scotiabank", color: "#EC111A" },
  { name: "Inbursa", color: "#00629B" },
  { name: "Banco Azteca", color: "#00A651" },
  { name: "BanBajío", color: "#00549F" },
  { name: "Banregio", color: "#8DC63F" },
  { name: "Banco del Bienestar", color: "#8B2942" },
  { name: "Nu México", color: "#820AD1" },
  { name: "Klar", color: "#111827" },
  { name: "Hey Banco", color: "#00E0B8" },
];
