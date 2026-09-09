import { describe, expect, it } from "vitest";
import { buildUnifiedDebts } from "./unified-debts";
import type { Account, Debt } from "@/types/database";

function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: "debt-1",
    user_id: "u1",
    name: "Préstamo",
    type: "loan",
    principal: 1000,
    interest_rate: 10,
    minimum_payment: 100,
    due_day: null,
    current_balance: 1000,
    archived_at: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeAccount(overrides: Partial<Account>): Account {
  return {
    id: "acc-1",
    user_id: "u1",
    name: "Cuenta",
    type: "credit",
    bank_name: null,
    initial_balance: 0,
    current_balance: 0,
    credit_limit: 1000,
    interest_rate: null,
    minimum_payment: null,
    cutoff_day: null,
    payment_due_day: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildUnifiedDebts", () => {
  it("incluye deudas activas (archived_at null) y excluye las archivadas", () => {
    const debts = [
      makeDebt({ id: "d1", name: "Préstamo activo", archived_at: null }),
      makeDebt({ id: "d2", name: "Tarjeta migrada", type: "credit_card", archived_at: "2026-02-01T00:00:00Z" }),
    ];
    const result = buildUnifiedDebts(debts, []);
    expect(result.map((r) => r.key)).toEqual(["debt:d1"]);
  });

  it("incluye todas las cuentas de crédito, con o sin saldo negativo", () => {
    const accounts = [
      makeAccount({ id: "a1", name: "Tarjeta con deuda", current_balance: -500 }),
      makeAccount({ id: "a2", name: "Tarjeta sin deuda", current_balance: 0 }),
      makeAccount({ id: "a3", name: "Débito", type: "debit", current_balance: 200 }),
    ];
    const result = buildUnifiedDebts([], accounts);
    expect(result.map((r) => r.key)).toEqual(["credit_account:a1", "credit_account:a2"]);
  });

  it("deriva current_balance de la cuenta de crédito como el monto adeudado (positivo)", () => {
    const result = buildUnifiedDebts([], [makeAccount({ id: "a1", current_balance: -750 })]);
    expect(result[0].current_balance).toBe(750);
  });

  it("usa 0 como default para interest_rate/minimum_payment de cuentas de crédito sin esos datos aún", () => {
    const result = buildUnifiedDebts(
      [],
      [makeAccount({ id: "a1", interest_rate: null, minimum_payment: null })]
    );
    expect(result[0].interest_rate).toBe(0);
    expect(result[0].minimum_payment).toBe(0);
  });

  it("combina ambas fuentes en una sola lista", () => {
    const result = buildUnifiedDebts(
      [makeDebt({ id: "d1" })],
      [makeAccount({ id: "a1" })]
    );
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.source)).toEqual(["debt", "credit_account"]);
  });
});
