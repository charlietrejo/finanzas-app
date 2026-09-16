import { getLastMonths, getMonthRange, shiftMonth } from "@/lib/date-utils";
import { advanceRecurringDate } from "@/lib/recurring";
import type { RecurringFrequency } from "@/types/database";

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

// Sección 3.4.2 del doc: `date`/`originalAmount` son los de la transacción de
// gasto ORIGINAL que dio origen al préstamo (inmutables), no current_balance
// (que ya viene descontado por los cobros — para reconstruir el saldo
// pendiente EN CADA MES histórico hace falta el monto original y la fecha de
// cada cobro, no el saldo ya reducido de hoy).
interface LoanGivenLike {
  originalAmount: number;
  date: string;
  repayments: { amount: number; date: string }[];
}

/**
 * Patrimonio neto histórico (sección 3.6). Fórmula simplificada (ver plan de
 * Fase 4): pagos de deuda y aportaciones a metas se cancelan algebraicamente
 * (mueven dinero entre "cuenta" y "pasivo"/"bolsillo" sin cambiar el neto),
 * así que solo hacen falta accounts.initial_balance, debts.principal y las
 * transacciones de ingreso/gasto — nada de debt_payments ni goal_contributions.
 *
 * Préstamos otorgados (sección 3.4.2) sí se suman aparte como activo: el
 * gasto que los origina YA está restado en cashFlow (como cualquier otro
 * gasto), lo que sin este ajuste subestima el patrimonio mientras el
 * préstamo sigue vigente — como si el dinero prestado hubiera desaparecido
 * en vez de ser un cobro pendiente.
 *
 *   netWorth(T) = Σ(initial_balance, cuentas creadas ≤ T)
 *               + Σ(ingresos, fecha ≤ T) − Σ(gastos, fecha ≤ T)
 *               − Σ(principal, deudas creadas ≤ T)
 *               + Σ(saldo pendiente de préstamos otorgados con fecha ≤ T)
 */
export function computeNetWorthSeries({
  accounts,
  debts,
  transactions,
  loansGiven = [],
  months,
  endMonth,
}: {
  accounts: AccountLike[];
  debts: DebtLike[];
  transactions: TransactionLike[];
  loansGiven?: LoanGivenLike[];
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

    const loansGivenOutstanding = loansGiven
      .filter((l) => l.date < end)
      .reduce((sum, l) => {
        const repaid = l.repayments.filter((r) => r.date < end).reduce((s, r) => s + r.amount, 0);
        return sum + Math.max(0, l.originalAmount - repaid);
      }, 0);

    return {
      month,
      netWorth: assetsBase + cashFlow - debtsBase + loansGivenOutstanding,
      projected: false,
    };
  });
}

export interface ProjectionTransactionLike {
  type: "income" | "expense" | "transfer";
  amount: number;
  date: string;
  is_recurring: boolean;
  recurring_frequency: RecurringFrequency | null;
  recurring_interval_days: number | null;
  recurring_end_date: string | null;
  next_occurrence_date: string | null;
}

// Salvaguarda contra una plantilla con datos corruptos (ej. recurring_end_date
// nunca llega) que de otro modo haría un while() casi infinito.
const MAX_RECURRING_ITERATIONS = 1000;

/**
 * Proyección de balance futuro (sección 3.6 del doc) — ya no es un promedio
 * simple de los deltas históricos. Cada mes proyectado combina dos
 * componentes que se calculan por separado a propósito, para no contar una
 * recurrencia dos veces:
 *
 *   proyección(mes) = saldo(mes anterior) + promedio_no_recurrente + recurrencias(mes)
 *
 * 1) `promedio_no_recurrente`: promedio del flujo neto (ingresos − gastos)
 *    de los últimos `historyMonths` meses, EXCLUYENDO transacciones
 *    is_recurring=true — si no se excluyeran, una recurrencia ya capturada
 *    explícitamente en (2) también se "diluiría" en este promedio.
 * 2) `recurrencias(mes)`: para cada plantilla activa (is_recurring=true),
 *    se avanza next_occurrence_date con advanceRecurringDate (mismo motor
 *    de Fase 8) ocurrencia por ocurrencia hasta el horizonte proyectado,
 *    sumando cada una en el bucket de SU mes exacto — así una recurrencia
 *    anual (ej. Strava) solo pesa en su mes de renovación, nunca se reparte
 *    entre los 12 meses.
 */
export function projectNetWorth(
  series: NetWorthPoint[],
  transactions: ProjectionTransactionLike[],
  monthsForward: number = 6,
  historyMonths: number = 6
): NetWorthPoint[] {
  if (series.length < 2) return series;

  const lastMonth = series[series.length - 1].month;

  // 1) Base histórica no-recurrente.
  const historyWindow = getLastMonths(historyMonths, lastMonth);
  const { start: historyStart } = getMonthRange(historyWindow[0]);
  const { end: historyEnd } = getMonthRange(lastMonth);
  const nonRecurringFlow = transactions
    .filter((t) => !t.is_recurring && t.date >= historyStart && t.date < historyEnd)
    .reduce((sum, t) => {
      if (t.type === "income") return sum + t.amount;
      if (t.type === "expense") return sum - t.amount;
      return sum;
    }, 0);
  const avgNonRecurringFlow = nonRecurringFlow / historyMonths;

  // 2) Recurrencias activas, ocurrencia por ocurrencia hasta el horizonte.
  const futureMonths = Array.from({ length: monthsForward }, (_, i) => shiftMonth(lastMonth, i + 1));
  const { end: horizonEnd } = getMonthRange(futureMonths[futureMonths.length - 1]);
  const recurringByMonth = new Map<string, number>(futureMonths.map((m) => [m, 0]));

  const templates = transactions.filter(
    (t): t is ProjectionTransactionLike & { recurring_frequency: RecurringFrequency; next_occurrence_date: string } =>
      t.is_recurring && t.type !== "transfer" && t.recurring_frequency !== null && t.next_occurrence_date !== null
  );

  for (const template of templates) {
    let occurrence = template.next_occurrence_date;
    let iterations = 0;
    while (occurrence < horizonEnd && iterations < MAX_RECURRING_ITERATIONS) {
      if (template.recurring_end_date && occurrence > template.recurring_end_date) break;

      const monthKey = occurrence.slice(0, 7);
      const bucket = recurringByMonth.get(monthKey);
      if (bucket !== undefined) {
        const delta = template.type === "income" ? template.amount : -template.amount;
        recurringByMonth.set(monthKey, bucket + delta);
      }

      occurrence = advanceRecurringDate(occurrence, template.recurring_frequency, template.recurring_interval_days);
      iterations++;
    }
  }

  // 3) Combinar.
  const projected: NetWorthPoint[] = [];
  let lastValue = series[series.length - 1].netWorth;
  for (const month of futureMonths) {
    lastValue += avgNonRecurringFlow + (recurringByMonth.get(month) ?? 0);
    projected.push({ month, netWorth: Math.round(lastValue * 100) / 100, projected: true });
  }

  return [...series, ...projected];
}
