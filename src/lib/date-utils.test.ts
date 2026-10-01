import { describe, expect, it } from "vitest";
import { getLastCutoffDate } from "./date-utils";

describe("getLastCutoffDate", () => {
  it("regresa el corte de este mes si ya ocurrió", () => {
    expect(getLastCutoffDate(10, new Date(Date.UTC(2026, 9, 15)))).toBe("2026-10-10");
  });

  it("regresa el corte de este mes si es justo hoy", () => {
    expect(getLastCutoffDate(10, new Date(Date.UTC(2026, 9, 10)))).toBe("2026-10-10");
  });

  it("regresa el corte del mes anterior si el de este mes todavía no llega", () => {
    expect(getLastCutoffDate(20, new Date(Date.UTC(2026, 9, 5)))).toBe("2026-09-20");
  });

  it("recorta el día de corte a los días reales del mes anterior (31 -> 28/29)", () => {
    expect(getLastCutoffDate(31, new Date(Date.UTC(2026, 2, 5)))).toBe("2026-02-28");
  });

  it("recorta el día de corte del mes actual si no existe ese día (31 en abril)", () => {
    expect(getLastCutoffDate(31, new Date(Date.UTC(2026, 3, 30)))).toBe("2026-04-30");
  });
});
