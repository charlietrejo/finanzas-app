import type { DebtType } from "@/types/database";

export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  credit_card: "Tarjeta",
  loan: "Préstamo",
  personal: "Persona",
};

export const DEBT_TYPES: DebtType[] = ["credit_card", "loan", "personal"];
