import { describe, expect, it } from "vitest";
import { computeMonthlyCashFlow } from "./cash-flow";

describe("computeMonthlyCashFlow", () => {
  it("agrupa ingresos y gastos por mes e ignora transferencias", () => {
    const result = computeMonthlyCashFlow(
      [
        { type: "income", amount: 1000, date: "2026-06-05" },
        { type: "expense", amount: 300, date: "2026-06-10" },
        { type: "transfer", amount: 500, date: "2026-06-15" },
        { type: "expense", amount: 200, date: "2026-05-01" },
      ],
      2,
      "2026-06"
    );

    expect(result).toEqual([
      { month: "2026-05", income: 0, expense: 200, net: -200 },
      { month: "2026-06", income: 1000, expense: 300, net: 700 },
    ]);
  });

  it("incluye meses sin movimientos en ceros", () => {
    const result = computeMonthlyCashFlow([], 3, "2026-03");
    expect(result.map((p) => p.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(result.every((p) => p.income === 0 && p.expense === 0 && p.net === 0)).toBe(true);
  });

  it("ignora transacciones fuera del rango solicitado", () => {
    const result = computeMonthlyCashFlow(
      [{ type: "income", amount: 100, date: "2025-01-01" }],
      3,
      "2026-03"
    );
    expect(result.reduce((s, p) => s + p.income, 0)).toBe(0);
  });
});
