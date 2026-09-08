import { describe, expect, it } from "vitest";
import { getBudgetStatus } from "./budget-status";

describe("getBudgetStatus", () => {
  it("devuelve ok cuando el gasto está por debajo del umbral de alerta", () => {
    expect(getBudgetStatus(700, 1000, 80)).toBe("ok");
  });

  it("devuelve warning al alcanzar el umbral de alerta", () => {
    expect(getBudgetStatus(800, 1000, 80)).toBe("warning");
  });

  it("devuelve warning justo antes de llegar al 100%", () => {
    expect(getBudgetStatus(999, 1000, 80)).toBe("warning");
  });

  it("devuelve over al llegar exactamente al 100%", () => {
    expect(getBudgetStatus(1000, 1000, 80)).toBe("over");
  });

  it("devuelve over al exceder el límite", () => {
    expect(getBudgetStatus(1200, 1000, 80)).toBe("over");
  });

  it("devuelve ok si el límite es cero o negativo (evita división por cero)", () => {
    expect(getBudgetStatus(100, 0, 80)).toBe("ok");
  });
});
