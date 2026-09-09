import { describe, expect, it } from "vitest";
import { getCreditCardDebts, getTotalCreditCardDebt } from "./credit-card-debt";

const accounts = [
  { id: "1", name: "Débito", type: "debit", current_balance: 500, credit_limit: null },
  { id: "2", name: "Tarjeta A", type: "credit", current_balance: -300, credit_limit: 1000 },
  { id: "3", name: "Tarjeta B", type: "credit", current_balance: 0, credit_limit: 500 },
  { id: "4", name: "Tarjeta C", type: "credit", current_balance: -50, credit_limit: 200 },
];

describe("getCreditCardDebts", () => {
  it("solo incluye cuentas de crédito con saldo negativo", () => {
    const result = getCreditCardDebts(accounts);
    expect(result).toEqual([
      { accountId: "2", name: "Tarjeta A", owed: 300, creditLimit: 1000 },
      { accountId: "4", name: "Tarjeta C", owed: 50, creditLimit: 200 },
    ]);
  });

  it("ignora cuentas no-crédito aunque tengan saldo negativo (no debería pasar por el constraint de BD, pero por si acaso)", () => {
    const result = getCreditCardDebts([{ id: "5", name: "X", type: "debit", current_balance: -10, credit_limit: null }]);
    expect(result).toEqual([]);
  });
});

describe("getTotalCreditCardDebt", () => {
  it("suma lo debido en todas las tarjetas", () => {
    expect(getTotalCreditCardDebt(accounts)).toBe(350);
  });

  it("devuelve 0 si no hay tarjetas con saldo negativo", () => {
    expect(getTotalCreditCardDebt([{ id: "1", name: "Débito", type: "debit", current_balance: 100, credit_limit: null }])).toBe(0);
  });
});
