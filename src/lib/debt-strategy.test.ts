import { describe, expect, it } from "vitest";
import { sortAvalanche, sortSnowball } from "./debt-strategy";

const debts = [
  { name: "A", current_balance: 5000, interest_rate: 10 },
  { name: "B", current_balance: 500, interest_rate: 36 },
  { name: "C", current_balance: 2000, interest_rate: 24 },
];

describe("sortSnowball", () => {
  it("ordena de menor a mayor saldo", () => {
    expect(sortSnowball(debts).map((d) => d.name)).toEqual(["B", "C", "A"]);
  });

  it("no muta el arreglo original", () => {
    const copy = [...debts];
    sortSnowball(debts);
    expect(debts).toEqual(copy);
  });
});

describe("sortAvalanche", () => {
  it("ordena de mayor a menor tasa de interés", () => {
    expect(sortAvalanche(debts).map((d) => d.name)).toEqual(["B", "C", "A"]);
  });
});
