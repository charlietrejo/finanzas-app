import type { Debt } from "@/types/database";

/**
 * Bola de nieve: pagar primero la deuda con menor saldo (impulso psicológico).
 * Avalancha: pagar primero la deuda con mayor tasa de interés (óptimo matemático).
 * Sugerencia visual pura (sección 3.4) — no se persiste ni cambia el flujo real de pagos.
 */
export function sortSnowball<T extends Pick<Debt, "current_balance">>(debts: T[]): T[] {
  return [...debts].sort((a, b) => a.current_balance - b.current_balance);
}

export function sortAvalanche<T extends Pick<Debt, "interest_rate">>(debts: T[]): T[] {
  return [...debts].sort((a, b) => b.interest_rate - a.interest_rate);
}
