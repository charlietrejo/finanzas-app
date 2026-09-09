import { describe, expect, it } from "vitest";
import { getUpcomingPayments } from "./upcoming-payments";

describe("getUpcomingPayments — deudas personales", () => {
  it("calcula el próximo día 2 del mes cuando todavía no ha pasado", () => {
    const result = getUpcomingPayments(
      { debts: [{ id: "1", name: "Préstamo", due_day: 2, minimum_payment: 500 }] },
      new Date("2026-03-01T00:00:00Z"),
      7
    );
    expect(result).toEqual([
      { key: "debt:1", source: "debt", name: "Préstamo", amount: 500, dueDate: "2026-03-02", daysUntil: 1 },
    ]);
  });

  it("salta al mes siguiente si el día ya pasó este mes", () => {
    const result = getUpcomingPayments(
      { debts: [{ id: "1", name: "Préstamo", due_day: 2 }] },
      new Date("2026-03-15T00:00:00Z"),
      40
    );
    expect(result[0].dueDate).toBe("2026-04-02");
  });

  it("limita el día al último día real del mes (ej. 31 en febrero)", () => {
    const result = getUpcomingPayments(
      { debts: [{ id: "1", name: "Préstamo", due_day: 31 }] },
      new Date("2026-02-01T00:00:00Z"),
      40
    );
    expect(result[0].dueDate).toBe("2026-02-28");
  });

  it("excluye deudas sin due_day", () => {
    const result = getUpcomingPayments(
      { debts: [{ id: "1", name: "Sin fecha", due_day: null }] },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result).toEqual([]);
  });
});

describe("getUpcomingPayments — cuentas de crédito", () => {
  it("usa payment_due_day y minimum_payment de la cuenta", () => {
    const result = getUpcomingPayments(
      { creditAccounts: [{ id: "a1", name: "HSBC VIVA", payment_due_day: 5, minimum_payment: 800 }] },
      new Date("2026-03-01T00:00:00Z"),
      7
    );
    expect(result).toEqual([
      { key: "credit_account:a1", source: "credit_account", name: "HSBC VIVA", amount: 800, dueDate: "2026-03-05", daysUntil: 4 },
    ]);
  });

  it("excluye cuentas sin payment_due_day configurado", () => {
    const result = getUpcomingPayments(
      { creditAccounts: [{ id: "a1", name: "Sin config", payment_due_day: null, minimum_payment: null }] },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result).toEqual([]);
  });
});

describe("getUpcomingPayments — transacciones recurrentes", () => {
  it("avanza una regla diaria varias veces si next_date quedó muy atrás", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          {
            id: "t1",
            note: "Suscripción",
            amount: 150,
            recurring_rule: { frequency: "daily", interval: 3, next_date: "2026-02-25" },
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z"),
      10
    );
    // 25, 28 -> mar 03 (siguiente múltiplo de 3 días >= hoy)
    expect(result[0].dueDate).toBe("2026-03-03");
  });

  it("avanza una regla semanal", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          {
            id: "t1",
            note: "Renta semanal",
            amount: 200,
            recurring_rule: { frequency: "weekly", interval: 1, next_date: "2026-02-15" },
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z"),
      10
    );
    expect(result[0].dueDate).toBe("2026-03-01");
  });

  it("avanza una regla mensual respetando el fin de mes", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          {
            id: "t1",
            note: "Netflix",
            amount: 219,
            recurring_rule: { frequency: "monthly", interval: 1, next_date: "2026-01-31" },
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z"),
      40
    );
    expect(result[0].dueDate).toBe("2026-03-31");
  });

  it("usa 'Movimiento recurrente' cuando la transacción no tiene nota", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          {
            id: "t1",
            note: null,
            amount: 100,
            recurring_rule: { frequency: "daily", interval: 1, next_date: "2026-03-01" },
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result[0].name).toBe("Movimiento recurrente");
  });

  it("ignora transacciones sin recurring_rule", () => {
    const result = getUpcomingPayments(
      { recurringTransactions: [{ id: "t1", note: "X", amount: 10, recurring_rule: null }] },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result).toEqual([]);
  });
});

describe("getUpcomingPayments — combinado", () => {
  it("unifica las 3 fuentes, filtra fuera de ventana y ordena por cercanía", () => {
    const result = getUpcomingPayments(
      {
        debts: [{ id: "d1", name: "Lejana", due_day: 25 }],
        creditAccounts: [{ id: "a1", name: "Cercana", payment_due_day: 3, minimum_payment: 100 }],
        recurringTransactions: [
          { id: "t1", note: "Media", amount: 50, recurring_rule: { frequency: "daily", interval: 1, next_date: "2026-03-05" } },
        ],
      },
      new Date("2026-03-01T00:00:00Z"),
      7
    );
    expect(result.map((r) => r.key)).toEqual(["credit_account:a1", "recurring_transaction:t1"]);
  });
});
