export interface CategoryDistributionSlice {
  categoryId: string;
  name: string;
  amount: number;
}

interface TransactionLike {
  type: "income" | "expense" | "transfer";
  amount: number;
  category_id: string | null;
}

interface CategoryLike {
  id: string;
  name: string;
}

// No "Otros": este bucket es sintético (categoryId "__other__", nunca una
// fila real de categories) y se confundía en la misma leyenda con la
// categoría real "Otros gastos" (sección 3.8 del doc).
const OTHER_LABEL = "Otras categorías";
const MAX_SLICES_DEFAULT = 8;

/**
 * Distribución de gastos por categoría (sección 3.6). Categorías más allá de
 * `maxSlices` (después de reservar una fila para "Otras categorías") se
 * agrupan, según la regla de la skill dataviz: una 9ª serie nunca es un
 * color generado.
 */
export function computeCategoryDistribution(
  transactions: TransactionLike[],
  categories: CategoryLike[],
  maxSlices: number = MAX_SLICES_DEFAULT
): CategoryDistributionSlice[] {
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, number>();

  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const key = t.category_id ?? "__uncategorized__";
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
  }

  const slices: CategoryDistributionSlice[] = [...totals.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      name: categoryId === "__uncategorized__" ? "Sin categoría" : (categoryNames.get(categoryId) ?? "Categoría eliminada"),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  if (slices.length <= maxSlices) {
    return slices;
  }

  const top = slices.slice(0, maxSlices - 1);
  const rest = slices.slice(maxSlices - 1);
  const otherAmount = rest.reduce((sum, s) => sum + s.amount, 0);

  return [...top, { categoryId: "__other__", name: OTHER_LABEL, amount: otherAmount }];
}
