import { describe, expect, it } from "vitest";
import { computeCategoryDistribution } from "./category-distribution";

const categories = [
  { id: "c1", name: "Supermercado" },
  { id: "c2", name: "Restaurantes" },
];

describe("computeCategoryDistribution", () => {
  it("suma gastos por categoría e ignora ingresos/transferencias", () => {
    const result = computeCategoryDistribution(
      [
        { type: "expense", amount: 300, category_id: "c1" },
        { type: "expense", amount: 100, category_id: "c1" },
        { type: "expense", amount: 200, category_id: "c2" },
        { type: "income", amount: 5000, category_id: "c1" },
        { type: "transfer", amount: 50, category_id: "c1" },
      ],
      categories
    );

    expect(result).toEqual([
      { categoryId: "c1", name: "Supermercado", amount: 400 },
      { categoryId: "c2", name: "Restaurantes", amount: 200 },
    ]);
  });

  it("agrupa transacciones sin categoría", () => {
    const result = computeCategoryDistribution(
      [{ type: "expense", amount: 50, category_id: null }],
      categories
    );
    expect(result).toEqual([{ categoryId: "__uncategorized__", name: "Sin categoría", amount: 50 }]);
  });

  it("agrupa categorías más allá del límite en 'Otros'", () => {
    const manyCategories = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: `Cat ${i}` }));
    const transactions = manyCategories.map((c, i) => ({
      type: "expense" as const,
      amount: 100 - i, // montos descendentes para orden predecible
      category_id: c.id,
    }));

    const result = computeCategoryDistribution(transactions, manyCategories, 8);

    expect(result).toHaveLength(8);
    expect(result[7].name).toBe("Otros");
    // últimas 3 categorías (montos 8,7 -> índices 7,8,9 con montos 93,92,91... ajustado)
    const otherAmount = result[7].amount;
    const expectedOther = transactions
      .slice(7)
      .reduce((sum, t) => sum + t.amount, 0);
    expect(otherAmount).toBe(expectedOther);
  });
});
