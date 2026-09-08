import { createClient } from "@/lib/supabase/server";
import { getExpenseTotalsByCategory } from "@/lib/budgets-data";
import { getCurrentMonth } from "@/lib/date-utils";
import { BudgetsClient } from "./budgets-client";
import type { Budget, Category } from "@/types/database";

export interface BudgetRow extends Budget {
  category: { name: string } | null;
}

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : getCurrentMonth();

  const supabase = await createClient();

  const [{ data: budgets }, { data: categories }, spentByCategory] = await Promise.all([
    supabase
      .from("budgets")
      .select("*, category:categories(name)")
      .eq("month", `${month}-01`)
      .order("created_at", { ascending: true }),
    supabase
      .from("categories")
      .select("*")
      .eq("type", "expense")
      .order("name", { ascending: true }),
    getExpenseTotalsByCategory(supabase, month),
  ]);

  return (
    <BudgetsClient
      month={month}
      budgets={(budgets ?? []) as unknown as BudgetRow[]}
      categories={(categories ?? []) as Category[]}
      spentByCategory={spentByCategory}
    />
  );
}
