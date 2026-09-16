import { describe, expect, it } from "vitest";
import { computeMonthlyInsights } from "./monthly-insights";

const CATEGORIES = [
  { id: "vivienda", is_essential: true },
  { id: "comida", is_essential: false },
];

describe("computeMonthlyInsights", () => {
  it("suma solo los gastos de categorías esenciales, aparte del total", () => {
    const result = computeMonthlyInsights(
      [
        { type: "expense", amount: 5000, category_id: "vivienda" },
        { type: "expense", amount: 1000, category_id: "comida" },
        { type: "income", amount: 20000, category_id: null }, // no debe contar como gasto
      ],
      CATEGORIES
    );

    expect(result.totalExpenses).toBe(6000);
    expect(result.essentialExpenses).toBe(5000);
  });

  it("una transacción sin categoría nunca cuenta como esencial", () => {
    const result = computeMonthlyInsights([{ type: "expense", amount: 500, category_id: null }], CATEGORIES);
    expect(result.essentialExpenses).toBe(0);
    expect(result.totalExpenses).toBe(500);
  });

  it("gasto hormiga: suma gastos menores a $200, sin importar categoría (incluso esencial)", () => {
    const result = computeMonthlyInsights(
      [
        { type: "expense", amount: 150, category_id: "comida" },
        { type: "expense", amount: 199.99, category_id: "vivienda" }, // esencial, pero igual cuenta si es chico
        { type: "expense", amount: 200, category_id: "comida" }, // el umbral mismo NO cuenta (estrictamente menor)
        { type: "expense", amount: 300, category_id: "comida" },
      ],
      CATEGORIES
    );

    expect(result.antExpenseTotal).toBe(150 + 199.99);
  });

  it("gasto hormiga y gastos esenciales son cortes independientes de los mismos datos", () => {
    // Un gasto puede contar en ambos cortes a la vez (ej. un copago médico
    // chico) — no son mutuamente excluyentes, son dos preguntas distintas.
    const result = computeMonthlyInsights([{ type: "expense", amount: 150, category_id: "vivienda" }], CATEGORIES);
    expect(result.essentialExpenses).toBe(150);
    expect(result.antExpenseTotal).toBe(150);
  });
});
