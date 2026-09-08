import { describe, expect, it } from "vitest";
import { computeNetWorthSeries, projectNetWorth } from "./net-worth";

describe("computeNetWorthSeries", () => {
  it("calcula el patrimonio neto acumulado mes a mes", () => {
    const result = computeNetWorthSeries({
      accounts: [{ initial_balance: 1000, created_at: "2026-01-01T00:00:00Z" }],
      debts: [{ principal: 200, created_at: "2026-01-01T00:00:00Z" }],
      transactions: [
        { type: "income", amount: 500, date: "2026-01-10" },
        { type: "expense", amount: 100, date: "2026-01-15" },
        { type: "income", amount: 300, date: "2026-02-05" },
      ],
      months: 2,
      endMonth: "2026-02",
    });

    // enero: 1000 + 500 - 100 - 200 = 1200
    expect(result[0]).toEqual({ month: "2026-01", netWorth: 1200, projected: false });
    // febrero: 1000 + (500-100+300) - 200 = 1500
    expect(result[1]).toEqual({ month: "2026-02", netWorth: 1500, projected: false });
  });

  it("no cuenta cuentas ni deudas creadas después del mes evaluado", () => {
    const result = computeNetWorthSeries({
      accounts: [{ initial_balance: 1000, created_at: "2026-03-01T00:00:00Z" }],
      debts: [],
      transactions: [],
      months: 3,
      endMonth: "2026-03",
    });

    expect(result[0].netWorth).toBe(0); // enero, la cuenta aún no existía
    expect(result[1].netWorth).toBe(0); // febrero
    expect(result[2].netWorth).toBe(1000); // marzo, la cuenta ya existe
  });

  it("los pagos de deuda y aportaciones a metas no afectan el patrimonio neto (no se leen aquí)", () => {
    // La fórmula deliberadamente ignora debt_payments/goal_contributions: el
    // dinero se mueve de una cuenta a un pasivo/bolsillo, el neto no cambia.
    const result = computeNetWorthSeries({
      accounts: [{ initial_balance: 1000, created_at: "2026-01-01T00:00:00Z" }],
      debts: [{ principal: 500, created_at: "2026-01-01T00:00:00Z" }],
      transactions: [],
      months: 1,
      endMonth: "2026-01",
    });
    expect(result[0].netWorth).toBe(500);
  });
});

describe("projectNetWorth", () => {
  it("proyecta usando el promedio de los deltas observados", () => {
    const series = [
      { month: "2026-01", netWorth: 1000, projected: false },
      { month: "2026-02", netWorth: 1100, projected: false },
      { month: "2026-03", netWorth: 1300, projected: false },
    ];
    // deltas: 100, 200 -> promedio 150
    const result = projectNetWorth(series, 2);
    expect(result).toHaveLength(5);
    expect(result[3]).toEqual({ month: "2026-04", netWorth: 1450, projected: true });
    expect(result[4]).toEqual({ month: "2026-05", netWorth: 1600, projected: true });
  });

  it("devuelve la serie sin cambios si hay menos de 2 puntos", () => {
    const series = [{ month: "2026-01", netWorth: 1000, projected: false }];
    expect(projectNetWorth(series, 3)).toEqual(series);
  });
});
