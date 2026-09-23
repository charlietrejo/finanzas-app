import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { computeMonthlyCashFlow, type CashFlowPoint } from "@/lib/cash-flow";
import { computeCategoryDistribution, type CategoryDistributionSlice } from "@/lib/category-distribution";
import { computeNetWorthSeries, projectNetWorth, type NetWorthPoint } from "@/lib/net-worth";
import { computeMonthlyInsights, type MonthlyInsights } from "@/lib/monthly-insights";
import { getCurrentMonth, getMonthRange } from "@/lib/date-utils";

export interface ReportsData {
  cashFlow: CashFlowPoint[];
  categoryDistribution: CategoryDistributionSlice[];
  netWorth: NetWorthPoint[];
  // Sección 3.6 del doc (post-revisión): meses de historial REAL que se
  // usaron para el promedio no-recurrente de la proyección — no siempre 6.
  // La UI (ReportsClient) avisa cuando es poco (cuenta nueva, pocos meses
  // de datos) para no leerse tan confiable como con 6 meses reales.
  netWorthHistoryMonths: number;
  monthlyInsights: MonthlyInsights;
}

/**
 * Trae los datos crudos necesarios para los reportes (sección 3.6) y delega
 * el cálculo a las funciones puras de src/lib/{cash-flow,category-distribution,net-worth}.ts.
 * netWorth necesita el historial COMPLETO de transacciones (no solo el rango
 * visible) porque es un acumulado desde el origen de cada cuenta/deuda.
 */
export async function getReportsData(
  supabase: SupabaseClient<Database>,
  months: number
): Promise<ReportsData> {
  const [{ data: accounts }, { data: debts }, { data: categories }, { data: allTransactions }, { data: loansGivenRaw }] =
    await Promise.all([
      supabase.from("accounts").select("initial_balance, created_at"),
      supabase.from("debts").select("principal, created_at"),
      supabase.from("categories").select("id, name, is_essential"),
      supabase
        .from("transactions")
        .select(
          "type, amount, date, category_id, is_adjustment, is_recurring, recurring_frequency, recurring_interval_days, recurring_end_date, next_occurrence_date"
        ),
      // Sección 3.4.2 del doc: transaction.date/amount son el origen y monto
      // TOTAL prestado (inmutables); loan_repayments trae cada cobro con su
      // fecha para poder reconstruir el saldo pendiente en cada mes histórico.
      supabase
        .from("loans_given")
        .select("transaction:transactions(date, amount), loan_repayments(amount, date)"),
    ]);

  const transactions = allTransactions ?? [];
  const loansGivenRows = (loansGivenRaw ?? []) as unknown as {
    transaction: { date: string; amount: number } | null;
    loan_repayments: { amount: number; date: string }[];
  }[];
  const loansGiven = loansGivenRows
    .filter((l) => l.transaction)
    .map((l) => ({
      originalAmount: l.transaction!.amount,
      date: l.transaction!.date,
      repayments: l.loan_repayments ?? [],
    }));

  const cashFlow = computeMonthlyCashFlow(transactions, months);
  const categoryDistribution = computeCategoryDistribution(transactions, categories ?? []);
  const netWorthHistory = computeNetWorthSeries({
    accounts: accounts ?? [],
    debts: debts ?? [],
    transactions,
    loansGiven,
    months,
  });
  const { series: netWorth, effectiveHistoryMonths: netWorthHistoryMonths } = projectNetWorth(
    netWorthHistory,
    transactions,
    6
  );

  // Secciones 3.6/3.8: "del mes" es el mes en curso, no el rango de
  // tendencia (6/12/24) — reusa `transactions` (ya trae el historial
  // completo) filtrando por el mes actual en vez de una query aparte.
  const currentMonthRange = getMonthRange(getCurrentMonth());
  const currentMonthTransactions = transactions.filter(
    (t) => t.date >= currentMonthRange.start && t.date < currentMonthRange.end
  );
  const monthlyInsights = computeMonthlyInsights(currentMonthTransactions, categories ?? []);

  return { cashFlow, categoryDistribution, netWorth, netWorthHistoryMonths, monthlyInsights };
}
