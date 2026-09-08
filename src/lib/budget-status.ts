export type BudgetStatus = "ok" | "warning" | "over";

/**
 * Determina el estado visual de un presupuesto según lo gastado contra su
 * límite y el % de alerta configurable (sección 3.3 del doc de requerimientos).
 */
export function getBudgetStatus(
  spent: number,
  limit: number,
  alertThresholdPct: number
): BudgetStatus {
  if (limit <= 0) return "ok";
  const pct = (spent / limit) * 100;
  if (pct >= 100) return "over";
  if (pct >= alertThresholdPct) return "warning";
  return "ok";
}
