import { getLastMonths, getMonthRange, shiftMonth } from "@/lib/date-utils";

export interface NetWorthPoint {
  month: string;
  netWorth: number;
  projected: boolean;
}

interface AccountLike {
  initial_balance: number;
  created_at: string;
}

interface DebtLike {
  principal: number;
  created_at: string;
}

interface TransactionLike {
  type: "income" | "expense" | "transfer";
  amount: number;
  date: string;
}

/**
 * Patrimonio neto histórico (sección 3.6). Fórmula simplificada (ver plan de
 * Fase 4): pagos de deuda y aportaciones a metas se cancelan algebraicamente
 * (mueven dinero entre "cuenta" y "pasivo"/"bolsillo" sin cambiar el neto),
 * así que solo hacen falta accounts.initial_balance, debts.principal y las
 * transacciones de ingreso/gasto — nada de debt_payments ni goal_contributions.
 *
 *   netWorth(T) = Σ(initial_balance, cuentas creadas ≤ T)
 *               + Σ(ingresos, fecha ≤ T) − Σ(gastos, fecha ≤ T)
 *               − Σ(principal, deudas creadas ≤ T)
 */
export function computeNetWorthSeries({
  accounts,
  debts,
  transactions,
  months,
  endMonth,
}: {
  accounts: AccountLike[];
  debts: DebtLike[];
  transactions: TransactionLike[];
  months: number;
  endMonth?: string;
}): NetWorthPoint[] {
  const monthList = getLastMonths(months, endMonth);

  return monthList.map((month) => {
    const { end } = getMonthRange(month); // exclusivo: primer día del mes siguiente

    const assetsBase = accounts
      .filter((a) => a.created_at < end)
      .reduce((sum, a) => sum + a.initial_balance, 0);

    const debtsBase = debts
      .filter((d) => d.created_at < end)
      .reduce((sum, d) => sum + d.principal, 0);

    const cashFlow = transactions
      .filter((t) => t.date < end)
      .reduce((sum, t) => {
        if (t.type === "income") return sum + t.amount;
        if (t.type === "expense") return sum - t.amount;
        return sum;
      }, 0);

    return {
      month,
      netWorth: assetsBase + cashFlow - debtsBase,
      projected: false,
    };
  });
}

/**
 * Proyección de balance futuro "según ritmo actual" (sección 3.6): extiende
 * la serie usando el promedio de los deltas mes a mes ya observados.
 */
export function projectNetWorth(series: NetWorthPoint[], monthsForward: number = 6): NetWorthPoint[] {
  if (series.length < 2) return series;

  const deltas: number[] = [];
  for (let i = 1; i < series.length; i++) {
    deltas.push(series[i].netWorth - series[i - 1].netWorth);
  }
  const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;

  const projected: NetWorthPoint[] = [];
  let lastMonth = series[series.length - 1].month;
  let lastValue = series[series.length - 1].netWorth;

  for (let i = 0; i < monthsForward; i++) {
    lastMonth = shiftMonth(lastMonth, 1);
    lastValue += avgDelta;
    projected.push({ month: lastMonth, netWorth: Math.round(lastValue * 100) / 100, projected: true });
  }

  return [...series, ...projected];
}
