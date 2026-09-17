import { describe, expect, it } from "vitest";
import { getUpcomingPayments } from "./upcoming-payments";

describe("getUpcomingPayments — deudas personales (due_day)", () => {
  it("calcula el próximo día 2 del mes cuando todavía no ha pasado", () => {
    const result = getUpcomingPayments(
      { debts: [{ id: "1", name: "Préstamo", type: "loan", due_day: 2, payment_due_day: null, minimum_payment: 500 }] },
      new Date("2026-03-01T00:00:00Z"),
      7
    );
    expect(result).toEqual([
      { key: "debt:1", source: "debt", name: "Préstamo", amount: 500, dueDate: "2026-03-02", daysUntil: 1 },
    ]);
  });

  it("salta al mes siguiente si el día ya pasó este mes", () => {
    const result = getUpcomingPayments(
      { debts: [{ id: "1", name: "Préstamo", type: "loan", due_day: 2, payment_due_day: null }] },
      new Date("2026-03-15T00:00:00Z"),
      40
    );
    expect(result[0].dueDate).toBe("2026-04-02");
  });

  it("limita el día al último día real del mes (ej. 31 en febrero)", () => {
    const result = getUpcomingPayments(
      { debts: [{ id: "1", name: "Préstamo", type: "loan", due_day: 31, payment_due_day: null }] },
      new Date("2026-02-01T00:00:00Z"),
      40
    );
    expect(result[0].dueDate).toBe("2026-02-28");
  });

  it("excluye deudas sin due_day ni payment_due_day", () => {
    const result = getUpcomingPayments(
      { debts: [{ id: "1", name: "Sin fecha", type: "loan", due_day: null, payment_due_day: null }] },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result).toEqual([]);
  });
});

describe("getUpcomingPayments — tarjetas de crédito (payment_due_day)", () => {
  it("usa payment_due_day y minimum_payment, y marca source como credit_account", () => {
    const result = getUpcomingPayments(
      {
        debts: [
          { id: "a1", name: "HSBC VIVA", type: "credit_card", due_day: null, payment_due_day: 5, minimum_payment: 800 },
        ],
      },
      new Date("2026-03-01T00:00:00Z"),
      7
    );
    expect(result).toEqual([
      { key: "debt:a1", source: "credit_account", name: "HSBC VIVA", amount: 800, dueDate: "2026-03-05", daysUntil: 4 },
    ]);
  });

  it("excluye tarjetas sin payment_due_day configurado", () => {
    const result = getUpcomingPayments(
      {
        debts: [
          { id: "a1", name: "Sin config", type: "credit_card", due_day: null, payment_due_day: null, minimum_payment: 0 },
        ],
      },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result).toEqual([]);
  });
});

describe("getUpcomingPayments — sección 3.4.1: fecha de corte de tarjeta como evento independiente", () => {
  it("agrega un evento aparte para cutoff_day, sin monto, distinto del de payment_due_day", () => {
    const result = getUpcomingPayments(
      {
        debts: [
          {
            id: "a1",
            name: "HSBC VIVA",
            type: "credit_card",
            due_day: null,
            payment_due_day: 5,
            cutoff_day: 2,
            minimum_payment: 800,
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z"),
      7
    );
    expect(result).toEqual([
      { key: "debt:a1:cutoff", source: "credit_account_cutoff", name: "HSBC VIVA · Fecha de corte", amount: null, dueDate: "2026-03-02", daysUntil: 1 },
      { key: "debt:a1", source: "credit_account", name: "HSBC VIVA", amount: 800, dueDate: "2026-03-05", daysUntil: 4 },
    ]);
  });

  it("sin cutoff_day no agrega el evento de corte", () => {
    const result = getUpcomingPayments(
      {
        debts: [
          { id: "a1", name: "HSBC VIVA", type: "credit_card", due_day: null, payment_due_day: 5, cutoff_day: null, minimum_payment: 800 },
        ],
      },
      new Date("2026-03-01T00:00:00Z"),
      7
    );
    expect(result.map((r) => r.source)).toEqual(["credit_account"]);
  });
});

describe("getUpcomingPayments — ventana default (sección 3.4.1)", () => {
  it("por default es de 5 días, no 7: algo a 6 días queda fuera sin ventana explícita", () => {
    const result = getUpcomingPayments(
      { debts: [{ id: "d1", name: "A 6 días", type: "loan", due_day: 7, payment_due_day: null }] },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result).toEqual([]);
  });

  it("ese mismo caso sí entra si se pide explícitamente una ventana de 6 días", () => {
    const result = getUpcomingPayments(
      { debts: [{ id: "d1", name: "A 6 días", type: "loan", due_day: 7, payment_due_day: null }] },
      new Date("2026-03-01T00:00:00Z"),
      6
    );
    expect(result).toHaveLength(1);
  });
});

describe("getUpcomingPayments — transacciones recurrentes", () => {
  it("avanza una frecuencia personalizada (cada N días) varias veces si el ancla quedó muy atrás", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          {
            id: "t1",
            note: "Suscripción",
            amount: 150,
            date: "2026-02-25",
            recurring_frequency: "custom",
            recurring_interval_days: 3,
            recurring_end_date: null,
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
            date: "2026-02-15",
            recurring_frequency: "weekly",
            recurring_interval_days: null,
            recurring_end_date: null,
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z"),
      10
    );
    expect(result[0].dueDate).toBe("2026-03-01");
  });

  it("avanza una regla mensual respetando el fin de mes (ej. Netflix el día 31)", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          {
            id: "t1",
            note: "Netflix",
            amount: 219,
            date: "2026-01-31",
            recurring_frequency: "monthly",
            recurring_interval_days: null,
            recurring_end_date: null,
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z"),
      40
    );
    expect(result[0].dueDate).toBe("2026-03-31");
  });

  it("avanza una regla anual (ej. anualidad de Strava)", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          {
            id: "t1",
            note: "Strava",
            amount: 700,
            date: "2025-04-10",
            recurring_frequency: "annual",
            recurring_interval_days: null,
            recurring_end_date: null,
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z"),
      60
    );
    expect(result[0].dueDate).toBe("2026-04-10");
  });

  it("usa 'Movimiento recurrente' cuando la transacción no tiene nota", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          {
            id: "t1",
            note: null,
            amount: 100,
            date: "2026-03-01",
            recurring_frequency: "custom",
            recurring_interval_days: 1,
            recurring_end_date: null,
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result[0].name).toBe("Movimiento recurrente");
  });

  it("ignora transacciones sin recurring_frequency", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          { id: "t1", note: "X", amount: 10, date: "2026-03-01", recurring_frequency: null, recurring_interval_days: null, recurring_end_date: null },
        ],
      },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result).toEqual([]);
  });

  it("excluye una recurrencia cuya próxima ocurrencia cae después de recurring_end_date", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          {
            id: "t1",
            note: "Suscripción con fin",
            amount: 100,
            date: "2026-02-01",
            recurring_frequency: "monthly",
            recurring_interval_days: null,
            recurring_end_date: "2026-02-15",
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z"),
      40
    );
    expect(result).toEqual([]);
  });
});

describe("getUpcomingPayments — secciones 3.2/3.4.1: recurrencia domiciliada/automática vs. manual", () => {
  it("recurrencia automática (default): isAutomatic true, templateId presente", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          {
            id: "t1",
            note: "Netflix",
            amount: 219,
            date: "2026-03-01",
            recurring_frequency: "monthly",
            recurring_interval_days: null,
            recurring_end_date: null,
            recurring_is_automatic: true,
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result).toEqual([
      {
        key: "recurring_transaction:t1",
        source: "recurring_transaction",
        name: "Netflix",
        amount: 219,
        dueDate: "2026-03-01",
        daysUntil: 0,
        templateId: "t1",
        isAutomatic: true,
      },
    ]);
  });

  it("recurrencia manual: isAutomatic false", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          {
            id: "t2",
            note: "Renta en efectivo",
            amount: 400,
            date: "2026-02-01",
            next_occurrence_date: "2026-03-01",
            recurring_frequency: "weekly",
            recurring_interval_days: null,
            recurring_end_date: null,
            recurring_is_automatic: false,
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result[0]).toMatchObject({ templateId: "t2", isAutomatic: false });
  });

  it("sin recurring_is_automatic (dato previo a la columna) se trata como automática", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          {
            id: "t3",
            note: "Legacy",
            amount: 100,
            date: "2026-03-01",
            recurring_frequency: "weekly",
            recurring_interval_days: null,
            recurring_end_date: null,
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result[0].isAutomatic).toBe(true);
  });

  it("las fuentes que no son recurrentes (deuda/tarjeta) no llevan templateId ni isAutomatic", () => {
    const result = getUpcomingPayments(
      { debts: [{ id: "d1", name: "Préstamo", type: "loan", due_day: 2, payment_due_day: null }] },
      new Date("2026-03-01T00:00:00Z"),
      7
    );
    expect(result[0].templateId).toBeUndefined();
    expect(result[0].isAutomatic).toBeUndefined();
  });
});

describe("getUpcomingPayments — sección 3.4.1: persistencia y acumulación de recordatorios manuales", () => {
  const MANUAL_BASE = {
    id: "m1",
    note: "Renta en efectivo",
    amount: 400,
    date: "2026-01-01",
    recurring_frequency: "weekly" as const,
    recurring_interval_days: null,
    recurring_end_date: null,
    recurring_is_automatic: false,
  };

  it("ventana propia de 3 días: aparece 3 días antes de next_occurrence_date, no 4", () => {
    const dueMonday = "2026-03-09"; // lunes
    const threeDaysBefore = getUpcomingPayments(
      { recurringTransactions: [{ ...MANUAL_BASE, next_occurrence_date: dueMonday }] },
      new Date("2026-03-06T00:00:00Z") // viernes
    );
    expect(threeDaysBefore).toHaveLength(1);

    const fourDaysBefore = getUpcomingPayments(
      { recurringTransactions: [{ ...MANUAL_BASE, next_occurrence_date: dueMonday }] },
      new Date("2026-03-05T00:00:00Z") // jueves
    );
    expect(fourDaysBefore).toHaveLength(0);
  });

  it("la ventana manual (3 días) es independiente de withinDays general: no se ensancha aunque withinDays sea mayor a 3", () => {
    const result = getUpcomingPayments(
      { recurringTransactions: [{ ...MANUAL_BASE, next_occurrence_date: "2026-03-10" }] },
      new Date("2026-03-01T00:00:00Z"),
      30
    );
    expect(result).toHaveLength(0);
  });

  it("persistencia: sigue visible aunque hayan pasado muchos días de la fecha, sin saltar de periodo solo", () => {
    const result = getUpcomingPayments(
      { recurringTransactions: [{ ...MANUAL_BASE, next_occurrence_date: "2026-01-05" }] },
      new Date("2026-03-01T00:00:00Z"), // 55 días después
      5
    );
    expect(result).toHaveLength(1);
    expect(result[0].dueDate).toBe("2026-01-05"); // no se movió al periodo "actual"
    expect(result[0].daysUntil).toBeLessThan(0);
  });

  it("vence hoy: overdueCount=1 (no todavía 'atrasado múltiple')", () => {
    const result = getUpcomingPayments(
      { recurringTransactions: [{ ...MANUAL_BASE, next_occurrence_date: "2026-03-01" }] },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result[0].overdueCount).toBe(1);
  });

  it("semanal: 10 días tarde acumula 2 pagos atrasados ($800), no se pierde el conteo", () => {
    const result = getUpcomingPayments(
      { recurringTransactions: [{ ...MANUAL_BASE, next_occurrence_date: "2026-02-19" }] }, // 10 días antes
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result[0]).toMatchObject({ overdueCount: 2, daysLate: 10 });
  });

  it("mensual: mismo comportamiento de acumulación que semanal, con su propio intervalo aproximado (30 días)", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          { ...MANUAL_BASE, recurring_frequency: "monthly", next_occurrence_date: "2026-01-01" },
        ],
      },
      new Date("2026-03-05T00:00:00Z") // 63 días después -> floor(63/30)=2 -> overdueCount=3
    );
    expect(result[0].overdueCount).toBe(3);
  });

  it("quincenal (custom cada 15 días): mismo comportamiento, sin importar la frecuencia", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          {
            ...MANUAL_BASE,
            recurring_frequency: "custom",
            recurring_interval_days: 15,
            next_occurrence_date: "2026-02-01",
          },
        ],
      },
      new Date("2026-03-04T00:00:00Z") // 31 días después -> floor(31/15)=2 -> overdueCount=3
    );
    expect(result[0].overdueCount).toBe(3);
  });

  it("confirmar (avanzar next_occurrence_date un intervalo) reduce el conteo en uno, sin desaparecer si seguía atrasado", () => {
    const before = getUpcomingPayments(
      { recurringTransactions: [{ ...MANUAL_BASE, next_occurrence_date: "2026-02-19" }] },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(before[0].overdueCount).toBe(2);

    const after = getUpcomingPayments(
      { recurringTransactions: [{ ...MANUAL_BASE, next_occurrence_date: "2026-02-26" }] }, // +7 días
      new Date("2026-03-01T00:00:00Z")
    );
    expect(after[0].overdueCount).toBe(1);
  });

  it("sin next_occurrence_date (dato incompleto) no genera el recordatorio", () => {
    const result = getUpcomingPayments({
      recurringTransactions: [{ ...MANUAL_BASE, next_occurrence_date: null }],
    });
    expect(result).toEqual([]);
  });

  it("respeta recurring_end_date ya vencido incluso siendo manual", () => {
    const result = getUpcomingPayments(
      {
        recurringTransactions: [
          { ...MANUAL_BASE, next_occurrence_date: "2026-03-01", recurring_end_date: "2026-02-01" },
        ],
      },
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result).toEqual([]);
  });
});

describe("getUpcomingPayments — combinado", () => {
  it("unifica deudas y transacciones recurrentes, filtra fuera de ventana y ordena por cercanía", () => {
    const result = getUpcomingPayments(
      {
        debts: [
          { id: "d1", name: "Lejana", type: "loan", due_day: 25, payment_due_day: null },
          { id: "a1", name: "Cercana", type: "credit_card", due_day: null, payment_due_day: 3, minimum_payment: 100 },
        ],
        recurringTransactions: [
          {
            id: "t1",
            note: "Media",
            amount: 50,
            date: "2026-03-05",
            recurring_frequency: "custom",
            recurring_interval_days: 1,
            recurring_end_date: null,
          },
        ],
      },
      new Date("2026-03-01T00:00:00Z"),
      7
    );
    expect(result.map((r) => r.key)).toEqual(["debt:a1", "recurring_transaction:t1"]);
  });
});
