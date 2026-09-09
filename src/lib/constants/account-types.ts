import type { AccountType } from "@/types/database";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Efectivo",
  debit: "Débito",
  credit: "Crédito",
  investment: "Inversión",
  savings: "Ahorro",
};

// "credit" ya no es creable (sección 6 del doc: las tarjetas viven en
// `debts`) — se conserva solo en ACCOUNT_TYPE_LABELS por si hiciera falta
// mostrar el tipo de una cuenta archivada.
export const ACCOUNT_TYPES: AccountType[] = ["cash", "debit", "investment", "savings"];
