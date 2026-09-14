import { describe, expect, it } from "vitest";
import { computeNetWorthSeries, projectNetWorth, type ProjectionTransactionLike } from "./net-worth";

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

/** Fábrica con los defaults de una transacción no recurrente, para no repetir los 5 campos de recurrencia en cada caso. */
function tx(overrides: Partial<ProjectionTransactionLike>): ProjectionTransactionLike {
  return {
    type: "expense",
    amount: 0,
    date: "2026-01-01",
    is_recurring: false,
    recurring_frequency: null,
    recurring_interval_days: null,
    recurring_end_date: null,
    next_occurrence_date: null,
    ...overrides,
  };
}

describe("projectNetWorth", () => {
  it("devuelve la serie sin cambios si hay menos de 2 puntos", () => {
    const series = [{ month: "2026-01", netWorth: 1000, projected: false }];
    expect(projectNetWorth(series, [], 3)).toEqual(series);
  });

  it("combina el promedio no-recurrente con la recurrencia exacta de cada mes (Netflix mensual)", () => {
    const series = [
      { month: "2026-01", netWorth: 800, projected: false },
      { month: "2026-02", netWorth: 900, projected: false },
      { month: "2026-03", netWorth: 1000, projected: false },
    ];
    // Base histórica: 1000 de ingreso no-recurrente cada uno de los últimos 3 meses -> promedio 1000.
    const transactions = [
      tx({ type: "income", amount: 1000, date: "2026-01-15" }),
      tx({ type: "income", amount: 1000, date: "2026-02-15" }),
      tx({ type: "income", amount: 1000, date: "2026-03-15" }),
      // Netflix: plantilla mensual, próxima ocurrencia justo al inicio del horizonte proyectado.
      tx({
        type: "expense",
        amount: 200,
        is_recurring: true,
        recurring_frequency: "monthly",
        next_occurrence_date: "2026-04-01",
      }),
    ];

    const result = projectNetWorth(series, transactions, 2, 3);

    expect(result).toHaveLength(5);
    // 1000 (saldo previo) + 1000 (promedio) - 200 (Netflix de abril) = 1800
    expect(result[3]).toEqual({ month: "2026-04", netWorth: 1800, projected: true });
    // 1800 + 1000 - 200 (Netflix de mayo) = 2600
    expect(result[4]).toEqual({ month: "2026-05", netWorth: 2600, projected: true });
  });

  it("una recurrencia anual (Strava) solo se suma en su mes de renovación, no se reparte entre los 12 meses", () => {
    const series = [
      { month: "2025-12", netWorth: 5000, projected: false },
      { month: "2026-01", netWorth: 5100, projected: false },
    ];
    // Sin transacciones no-recurrentes: promedio histórico = 0, para aislar
    // el efecto de la recurrencia.
    const transactions = [
      tx({
        type: "expense",
        amount: 700,
        is_recurring: true,
        recurring_frequency: "annual",
        next_occurrence_date: "2026-04-10",
      }),
    ];

    const result = projectNetWorth(series, transactions, 12, 3);
    const byMonth = Object.fromEntries(result.map((p) => [p.month, p.netWorth]));

    // Los 2 meses antes de la renovación no cambian (promedio=0, sin recurrencia todavía).
    expect(byMonth["2026-02"]).toBe(5100);
    expect(byMonth["2026-03"]).toBe(5100);
    // Abril: única caída de 700, justo en el mes de renovación de Strava.
    expect(byMonth["2026-04"]).toBe(4400);
    // El resto del año NO vuelve a descontar los 700 — se queda en el nuevo
    // nivel, la recurrencia anual no se repite mes a mes.
    expect(byMonth["2026-05"]).toBe(4400);
    expect(byMonth["2026-08"]).toBe(4400);
    expect(byMonth["2026-12"]).toBe(4400);
    expect(byMonth["2027-01"]).toBe(4400);

    // Confirma explícitamente que solo UN mes de los 12 proyectados absorbió el cargo.
    const monthsWithDrop = result.filter((p) => p.projected).filter((p, i, arr) => {
      const prev = i === 0 ? 5100 : arr[i - 1].netWorth;
      return p.netWorth < prev;
    });
    expect(monthsWithDrop).toHaveLength(1);
    expect(monthsWithDrop[0].month).toBe("2026-04");
  });

  it("excluye del promedio histórico las transacciones marcadas is_recurring=true (para no contarlas dos veces)", () => {
    const series = [
      { month: "2025-12", netWorth: 1000, projected: false },
      { month: "2026-01", netWorth: 1200, projected: false },
    ];
    const transactions = [
      tx({ type: "income", amount: 500, date: "2026-01-10" }),
      // Esta ya ocurrió (primera ocurrencia real de una plantilla) pero al
      // estar marcada is_recurring=true no debe promediarse — su próxima
      // ocurrencia (fuera del horizonte de 1 mes proyectado) se maneja
      // aparte, por el punto 2 de la fórmula.
      tx({
        type: "expense",
        amount: 300,
        date: "2026-01-12",
        is_recurring: true,
        recurring_frequency: "monthly",
        next_occurrence_date: "2027-06-01",
      }),
    ];

    const result = projectNetWorth(series, transactions, 1, 1);

    // Si los 300 recurrentes se hubieran restado del promedio, febrero daría 1400.
    // Al excluirlos, el promedio es solo el ingreso de 500.
    expect(result[2]).toEqual({ month: "2026-02", netWorth: 1700, projected: true });
  });
});
