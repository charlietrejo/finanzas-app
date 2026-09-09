import type { DebtType } from "@/types/database";

// "credit_card" ya no es creable (ver sección 6 del doc): se conserva solo
// para mostrar la etiqueta de filas archivadas heredadas de la migración 016.
export const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  credit_card: "Tarjeta",
  loan: "Préstamo",
  personal: "Persona",
};

export const DEBT_TYPES: DebtType[] = ["loan", "personal"];
