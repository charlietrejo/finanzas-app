import type { RecurringRule } from "@/types/database";

export type UpcomingPaymentSource = "debt" | "credit_account" | "recurring_transaction";

export interface UpcomingPayment {
  key: string;
  source: UpcomingPaymentSource;
  name: string;
  amount: number | null;
  dueDate: string;
  daysUntil: number;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * `due_day`/`payment_due_day` son un día del mes (1-31, sección 3.4: "si se
 * pone el 2, será el día 2 de cada mes"). Calcula la próxima ocurrencia desde
 * `today`, con el día limitado a los días reales del mes (ej. día 31 en
 * febrero -> 28/29).
 */
function nextMonthlyDueDate(dueDay: number, today: Date): Date {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const todayMidnight = new Date(Date.UTC(year, month, today.getUTCDate()));

  const thisMonthDay = Math.min(dueDay, daysInMonth(year, month));
  const thisMonth = new Date(Date.UTC(year, month, thisMonthDay));
  if (thisMonth.getTime() >= todayMidnight.getTime()) {
    return thisMonth;
  }

  const nextMonthDay = Math.min(dueDay, daysInMonth(year, month + 1));
  return new Date(Date.UTC(year, month + 1, nextMonthDay));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * `recurring_rule.next_date` se guarda al crear la transacción y nunca se
 * actualiza solo (no hay job que lo avance) — así que aquí se calcula la
 * próxima ocurrencia real avanzando la fecha ancla por `frequency`/`interval`
 * las veces que hagan falta hasta llegar a hoy o después. Para "monthly" se
 * recalcula cada paso desde el día original (no desde el día ya recortado del
 * paso anterior), para que un ancla en día 31 no quede fija en 28/30 para
 * siempre tras pasar por un mes corto.
 */
function nextRecurringDate(rule: RecurringRule, today: Date): Date {
  const [y, m, d] = rule.next_date.slice(0, 10).split("-").map(Number);
  const todayMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const interval = Math.max(1, rule.interval);
  let iterations = 0;

  if (rule.frequency === "monthly") {
    let monthIndex = m - 1;
    let year = y;
    let date = new Date(Date.UTC(year, monthIndex, Math.min(d, daysInMonth(year, monthIndex))));
    while (date.getTime() < todayMidnight.getTime() && iterations < 10_000) {
      monthIndex += interval;
      year += Math.floor(monthIndex / 12);
      monthIndex = ((monthIndex % 12) + 12) % 12;
      date = new Date(Date.UTC(year, monthIndex, Math.min(d, daysInMonth(year, monthIndex))));
      iterations++;
    }
    return date;
  }

  const stepDays = rule.frequency === "daily" ? interval : interval * 7;
  let date = new Date(Date.UTC(y, m - 1, d));
  while (date.getTime() < todayMidnight.getTime() && iterations < 10_000) {
    date = addDays(date, stepDays);
    iterations++;
  }
  return date;
}

function toUpcoming(
  key: string,
  source: UpcomingPaymentSource,
  name: string,
  amount: number | null,
  due: Date,
  today: Date
): UpcomingPayment {
  const todayMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const daysUntil = Math.round((due.getTime() - todayMidnight.getTime()) / 86_400_000);
  return { key, source, name, amount, dueDate: due.toISOString().slice(0, 10), daysUntil };
}

interface DebtLike {
  id: string;
  name: string;
  type: string;
  due_day: number | null;
  payment_due_day: number | null;
  minimum_payment?: number;
}

interface RecurringTransactionLike {
  id: string;
  note: string | null;
  amount: number;
  recurring_rule: RecurringRule | null;
}

/**
 * Zona de alertas de próximos pagos del Dashboard (sección 3.4.1): unifica
 * dos fuentes de vencimientos — deudas (préstamos/personales por `due_day`,
 * tarjetas por `payment_due_day`, ambas viven en `debts`) y transacciones
 * recurrentes — en una sola lista ordenada por cercanía.
 */
export function getUpcomingPayments(
  input: {
    debts?: DebtLike[];
    recurringTransactions?: RecurringTransactionLike[];
  },
  today: Date = new Date(),
  withinDays: number = 7
): UpcomingPayment[] {
  const { debts = [], recurringTransactions = [] } = input;
  const upcoming: UpcomingPayment[] = [];

  for (const debt of debts) {
    const dueDay = debt.due_day ?? debt.payment_due_day;
    if (!dueDay) continue;
    upcoming.push(
      toUpcoming(
        `debt:${debt.id}`,
        debt.type === "credit_card" ? "credit_account" : "debt",
        debt.name,
        debt.minimum_payment ?? null,
        nextMonthlyDueDate(dueDay, today),
        today
      )
    );
  }

  for (const tx of recurringTransactions) {
    if (!tx.recurring_rule) continue;
    upcoming.push(
      toUpcoming(
        `recurring_transaction:${tx.id}`,
        "recurring_transaction",
        tx.note || "Movimiento recurrente",
        tx.amount,
        nextRecurringDate(tx.recurring_rule, today),
        today
      )
    );
  }

  return upcoming.filter((p) => p.daysUntil <= withinDays).sort((a, b) => a.daysUntil - b.daysUntil);
}
