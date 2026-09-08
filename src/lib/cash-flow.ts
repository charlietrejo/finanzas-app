import { getLastMonths } from "@/lib/date-utils";

export interface CashFlowPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
}

interface TransactionLike {
  type: "income" | "expense" | "transfer";
  amount: number;
  date: string;
}

/**
 * Flujo de efectivo mensual (sección 3.6): ingresos vs. egresos por mes.
 * Las transferencias no se cuentan (no son ingreso ni gasto real).
 */
export function computeMonthlyCashFlow(
  transactions: TransactionLike[],
  months: number,
  endMonth?: string
): CashFlowPoint[] {
  const monthList = getLastMonths(months, endMonth);
  const points = new Map<string, CashFlowPoint>(
    monthList.map((month) => [month, { month, income: 0, expense: 0, net: 0 }])
  );

  for (const t of transactions) {
    const month = t.date.slice(0, 7);
    const point = points.get(month);
    if (!point) continue;
    if (t.type === "income") point.income += t.amount;
    else if (t.type === "expense") point.expense += t.amount;
  }

  for (const point of points.values()) {
    point.net = point.income - point.expense;
  }

  return monthList.map((month) => points.get(month)!);
}
