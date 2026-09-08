import { describe, expect, it } from "vitest";
import { buildAmortizationSchedule } from "./amortization";

describe("buildAmortizationSchedule", () => {
  it("salda una deuda sin interés en el número exacto de meses", () => {
    const result = buildAmortizationSchedule({ balance: 1000, annualRatePct: 0, monthlyPayment: 250 });
    expect(result.months).toBe(4);
    expect(result.neverPaysOff).toBe(false);
    expect(result.rows[3].remainingBalance).toBe(0);
  });

  it("el último pago se ajusta para no dejar saldo negativo", () => {
    const result = buildAmortizationSchedule({ balance: 1000, annualRatePct: 0, monthlyPayment: 300 });
    expect(result.months).toBe(4);
    expect(result.rows[3].payment).toBe(100);
    expect(result.rows[3].remainingBalance).toBe(0);
  });

  it("marca neverPaysOff cuando el pago no cubre el interés", () => {
    const result = buildAmortizationSchedule({ balance: 1000, annualRatePct: 36, monthlyPayment: 10 });
    expect(result.neverPaysOff).toBe(true);
    expect(result.rows.length).toBe(0);
  });

  it("con interés, cada fila reduce el saldo y suma interés + capital = pago", () => {
    const result = buildAmortizationSchedule({ balance: 1000, annualRatePct: 24, monthlyPayment: 100 });
    for (const row of result.rows) {
      expect(Math.round((row.interest + row.principal) * 100) / 100).toBe(row.payment);
    }
    expect(result.rows[result.rows.length - 1].remainingBalance).toBe(0);
  });

  it("un saldo de cero no genera filas", () => {
    const result = buildAmortizationSchedule({ balance: 0, annualRatePct: 10, monthlyPayment: 100 });
    expect(result.rows).toEqual([]);
    expect(result.neverPaysOff).toBe(false);
  });
});
