import { describe, expect, it } from "vitest";
import { checkTransactionBalance } from "./balance";

describe("checkTransactionBalance", () => {
  it("rechaza un gasto que deja saldo negativo en cuenta débito", () => {
    const result = checkTransactionBalance({
      accountType: "debit",
      currentBalance: 100,
      creditLimit: null,
      transactionType: "expense",
      amount: 150,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/insuficiente/i);
  });

  it("acepta un gasto que deja saldo exactamente en cero en cuenta débito", () => {
    const result = checkTransactionBalance({
      accountType: "debit",
      currentBalance: 100,
      creditLimit: null,
      transactionType: "expense",
      amount: 100,
    });
    expect(result.valid).toBe(true);
    expect(result.newBalance).toBe(0);
  });

  it("acepta un gasto en cuenta de crédito hasta el credit_limit", () => {
    const result = checkTransactionBalance({
      accountType: "credit",
      currentBalance: 0,
      creditLimit: 500,
      transactionType: "expense",
      amount: 500,
    });
    expect(result.valid).toBe(true);
    expect(result.newBalance).toBe(-500);
  });

  it("rechaza un gasto en cuenta de crédito que excede el credit_limit", () => {
    const result = checkTransactionBalance({
      accountType: "credit",
      currentBalance: 0,
      creditLimit: 500,
      transactionType: "expense",
      amount: 500.01,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/límite de crédito/i);
  });

  it("un ingreso siempre es válido y suma al saldo", () => {
    const result = checkTransactionBalance({
      accountType: "savings",
      currentBalance: 200,
      creditLimit: null,
      transactionType: "income",
      amount: 50,
    });
    expect(result.valid).toBe(true);
    expect(result.newBalance).toBe(250);
  });

  it("rechaza monto cero o negativo", () => {
    const result = checkTransactionBalance({
      accountType: "cash",
      currentBalance: 100,
      creditLimit: null,
      transactionType: "expense",
      amount: 0,
    });
    expect(result.valid).toBe(false);
  });
});
