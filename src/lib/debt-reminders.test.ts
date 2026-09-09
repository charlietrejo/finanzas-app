import { describe, expect, it } from "vitest";
import { getUpcomingDebtPayments } from "./debt-reminders";

describe("getUpcomingDebtPayments", () => {
  it("calcula el próximo día 2 del mes cuando todavía no ha pasado", () => {
    const result = getUpcomingDebtPayments(
      [{ id: "1", name: "Tarjeta", due_day: 2 }],
      new Date("2026-03-01T00:00:00Z"),
      7
    );
    expect(result).toEqual([{ debtId: "1", name: "Tarjeta", dueDate: "2026-03-02", daysUntil: 1 }]);
  });

  it("salta al mes siguiente si el día ya pasó este mes", () => {
    const result = getUpcomingDebtPayments(
      [{ id: "1", name: "Tarjeta", due_day: 2 }],
      new Date("2026-03-15T00:00:00Z"),
      40
    );
    expect(result[0].dueDate).toBe("2026-04-02");
  });

  it("hoy mismo cuenta como daysUntil = 0", () => {
    const result = getUpcomingDebtPayments(
      [{ id: "1", name: "Tarjeta", due_day: 15 }],
      new Date("2026-03-15T00:00:00Z"),
      7
    );
    expect(result[0].daysUntil).toBe(0);
  });

  it("limita el día al último día real del mes (ej. 31 en febrero)", () => {
    const result = getUpcomingDebtPayments(
      [{ id: "1", name: "Tarjeta", due_day: 31 }],
      new Date("2026-02-01T00:00:00Z"),
      40
    );
    expect(result[0].dueDate).toBe("2026-02-28"); // 2026 no es bisiesto
  });

  it("excluye deudas sin due_day", () => {
    const result = getUpcomingDebtPayments(
      [{ id: "1", name: "Sin fecha", due_day: null }],
      new Date("2026-03-01T00:00:00Z")
    );
    expect(result).toEqual([]);
  });

  it("excluye deudas fuera de la ventana de días y ordena por cercanía", () => {
    const result = getUpcomingDebtPayments(
      [
        { id: "far", name: "Lejana", due_day: 25 },
        { id: "near", name: "Cercana", due_day: 3 },
      ],
      new Date("2026-03-01T00:00:00Z"),
      7
    );
    expect(result.map((r) => r.debtId)).toEqual(["near"]);
  });
});
