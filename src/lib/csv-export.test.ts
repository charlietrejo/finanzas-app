import { describe, expect, it } from "vitest";
import { buildCsv } from "./csv-export";

describe("buildCsv", () => {
  it("genera encabezados y filas separados por coma", () => {
    const csv = buildCsv(["Mes", "Ingresos"], [["2026-01", 1000], ["2026-02", 2000]]);
    expect(csv).toBe("Mes,Ingresos\r\n2026-01,1000\r\n2026-02,2000");
  });

  it("escapa celdas con comas, comillas o saltos de línea", () => {
    const csv = buildCsv(["Nota"], [['Comió en "el café", bien'], ["línea1\nlínea2"]]);
    expect(csv).toContain('"Comió en ""el café"", bien"');
    expect(csv).toContain('"línea1\nlínea2"');
  });
});
