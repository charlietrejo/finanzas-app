// Secciones 3.6/3.8 del doc: dos cortes distintos de los gastos del mes —
// uno por tipo de necesidad (esencial/no esencial, vía categories.is_essential),
// otro por tamaño/frecuencia de transacción (gasto hormiga), deliberadamente
// separados aunque vienen de los mismos datos.

// Umbral inicial fijo (sección 3.8: "pensado para ajustarse después si se
// vuelve configurable" — no lo es todavía, así que no hay UI para cambiarlo).
export const ANT_EXPENSE_THRESHOLD = 200;

export interface MonthlyInsights {
  totalExpenses: number;
  essentialExpenses: number;
  /** "Gasto hormiga": transacciones de gasto < ANT_EXPENSE_THRESHOLD, sin importar categoría. */
  antExpenseTotal: number;
}

interface TransactionLike {
  type: "income" | "expense" | "transfer";
  amount: number;
  category_id: string | null;
}

interface CategoryLike {
  id: string;
  is_essential: boolean;
}

export function computeMonthlyInsights(
  transactions: TransactionLike[],
  categories: CategoryLike[]
): MonthlyInsights {
  const essentialCategoryIds = new Set(categories.filter((c) => c.is_essential).map((c) => c.id));
  const expenses = transactions.filter((t) => t.type === "expense");

  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);

  const essentialExpenses = expenses
    .filter((t) => t.category_id !== null && essentialCategoryIds.has(t.category_id))
    .reduce((sum, t) => sum + t.amount, 0);

  const antExpenseTotal = expenses
    .filter((t) => t.amount < ANT_EXPENSE_THRESHOLD)
    .reduce((sum, t) => sum + t.amount, 0);

  return { totalExpenses, essentialExpenses, antExpenseTotal };
}
