import type { AccountType } from "@/types/database";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Efectivo",
  debit: "Débito",
  credit: "Crédito",
  investment: "Inversión",
  savings: "Ahorro",
};

export const ACCOUNT_TYPES: AccountType[] = ["cash", "debit", "credit", "investment", "savings"];
