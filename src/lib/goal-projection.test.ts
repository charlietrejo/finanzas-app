import { describe, expect, it } from "vitest";
import { projectGoalCompletion } from "./goal-projection";

describe("projectGoalCompletion", () => {
  it("devuelve completed si ya se alcanzó o superó la meta", () => {
    const result = projectGoalCompletion({
      targetAmount: 1000,
      currentAmount: 1000,
      createdAt: "2026-01-01",
      targetDate: "2026-12-01",
      today: new Date("2026-03-01"),
    });
    expect(result.status).toBe("completed");
  });

  it("devuelve insufficient_data si la meta es muy reciente", () => {
    const result = projectGoalCompletion({
      targetAmount: 1000,
      currentAmount: 100,
      createdAt: "2026-03-01",
      targetDate: "2026-12-01",
      today: new Date("2026-03-02"),
    });
    expect(result.status).toBe("insufficient_data");
  });

  it("devuelve no_progress si no se ha aportado nada", () => {
    const result = projectGoalCompletion({
      targetAmount: 1000,
      currentAmount: 0,
      createdAt: "2026-01-01",
      targetDate: "2026-12-01",
      today: new Date("2026-03-01"),
    });
    expect(result.status).toBe("no_progress");
  });

  it("proyecta una fecha de cumplimiento y marca onTrack cuando alcanza a tiempo", () => {
    // ritmo: 300 en 1 mes (~30.44 días) -> sobran 700, ~2.33 meses más
    const result = projectGoalCompletion({
      targetAmount: 1000,
      currentAmount: 300,
      createdAt: "2026-01-01",
      targetDate: "2026-12-01",
      today: new Date("2026-01-31"),
    });
    expect(result.status).toBe("projected");
    expect(result.monthsToGo).toBeGreaterThan(0);
    expect(result.onTrack).toBe(true);
  });

  it("marca onTrack en false cuando el ritmo actual no llega antes de la fecha límite", () => {
    const result = projectGoalCompletion({
      targetAmount: 100000,
      currentAmount: 100,
      createdAt: "2026-01-01",
      targetDate: "2026-02-01",
      today: new Date("2026-01-31"),
    });
    expect(result.status).toBe("projected");
    expect(result.onTrack).toBe(false);
  });
});
