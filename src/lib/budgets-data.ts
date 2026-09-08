import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getMonthRange } from "@/lib/date-utils";

/**
 * Suma los gastos (type=expense) por categoría dentro de un mes, para
 * comparar presupuestado vs. real (sección 3.3 del doc de requerimientos).
 * Se calcula en JS a partir de las transacciones del mes en vez de una vista
 * SQL: el volumen esperado por usuario es bajo y evita otra migración.
 */
export async function getExpenseTotalsByCategory(
  supabase: SupabaseClient<Database>,
  month: string
): Promise<Record<string, number>> {
  const { start, end } = getMonthRange(month);

  const { data, error } = await supabase
    .from("transactions")
    .select("category_id, amount")
    .eq("type", "expense")
    .gte("date", start)
    .lt("date", end);

  if (error) throw error;

  const totals: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!row.category_id) continue;
    totals[row.category_id] = (totals[row.category_id] ?? 0) + row.amount;
  }
  return totals;
}
