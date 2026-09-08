import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { computeMonthlyCashFlow, type CashFlowPoint } from "@/lib/cash-flow";
import { computeCategoryDistribution, type CategoryDistributionSlice } from "@/lib/category-distribution";
import { computeNetWorthSeries, projectNetWorth, type NetWorthPoint } from "@/lib/net-worth";

export interface ReportsData {
  cashFlow: CashFlowPoint[];
  categoryDistribution: CategoryDistributionSlice[];
  netWorth: NetWorthPoint[];
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
  const [{ data: accounts }, { data: debts }, { data: categories }, { data: allTransactions }] =
    await Promise.all([
      supabase.from("accounts").select("initial_balance, created_at"),
      supabase.from("debts").select("principal, created_at"),
      supabase.from("categories").select("id, name"),
      supabase.from("transactions").select("type, amount, date, category_id"),
    ]);

  const transactions = allTransactions ?? [];

  const cashFlow = computeMonthlyCashFlow(transactions, months);
  const categoryDistribution = computeCategoryDistribution(transactions, categories ?? []);
  const netWorthHistory = computeNetWorthSeries({
    accounts: accounts ?? [],
    debts: debts ?? [],
    transactions,
    months,
  });
  const netWorth = projectNetWorth(netWorthHistory, 6);

  return { cashFlow, categoryDistribution, netWorth };
}
