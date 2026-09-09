import { describe, expect, it } from "vitest";
import { advanceRecurringDate } from "./recurring";

describe("advanceRecurringDate", () => {
  it("semanal: suma 7 días", () => {
    expect(advanceRecurringDate("2026-03-01", "weekly", null)).toBe("2026-03-08");
  });

  it("personalizada: suma recurring_interval_days", () => {
    expect(advanceRecurringDate("2026-03-01", "custom", 3)).toBe("2026-03-04");
  });

  it("personalizada sin recurring_interval_days: por seguridad avanza 1 día en vez de quedarse fija", () => {
    expect(advanceRecurringDate("2026-03-01", "custom", null)).toBe("2026-03-02");
  });

  it("mensual: suma un mes conservando el día", () => {
    expect(advanceRecurringDate("2026-01-15", "monthly", null)).toBe("2026-02-15");
  });

  it("mensual: recorta el día 31 al último día real del mes destino (Netflix el 31 de enero)", () => {
    expect(advanceRecurringDate("2026-01-31", "monthly", null)).toBe("2026-02-28");
  });

  it("mensual: encadenar el resultado (como hace el cron con next_occurrence_date) sí arrastra el recorte de un mes corto", () => {
    const first = advanceRecurringDate("2026-01-31", "monthly", null);
    expect(first).toBe("2026-02-28");
    // Encadenar el 28 ya recortado como ancla del siguiente paso avanza a
    // marzo 28, no marzo 31 — limitación aceptada del diseño del doc
    // ("sumando el intervalo" desde next_occurrence_date), distinta de
    // proyectar varios `steps` desde el mismo ancla inmutable (ver abajo).
    const second = advanceRecurringDate(first, "monthly", null);
    expect(second).toBe("2026-03-28");
  });

  it("mensual: proyectar varios `steps` desde el MISMO ancla no arrastra el recorte (uso de upcoming-payments.ts)", () => {
    // Desde el mismo ancla original (31 de enero), el paso 2 debe caer en
    // marzo 31 (no 28) porque se recalcula desde el día original cada vez.
    expect(advanceRecurringDate("2026-01-31", "monthly", null, 2)).toBe("2026-03-31");
  });

  it("mensual: fin de año pasa correctamente a enero del año siguiente", () => {
    expect(advanceRecurringDate("2026-12-15", "monthly", null)).toBe("2027-01-15");
  });

  it("anual: suma un año conservando mes y día (anualidad de Strava)", () => {
    expect(advanceRecurringDate("2025-04-10", "annual", null)).toBe("2026-04-10");
  });

  it("anual: 29 de febrero en año bisiesto cae en 28 en un año no bisiesto", () => {
    expect(advanceRecurringDate("2024-02-29", "annual", null)).toBe("2025-02-28");
  });
});
