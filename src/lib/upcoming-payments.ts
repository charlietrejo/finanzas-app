import { advanceRecurringDate } from "@/lib/recurring";
import type { RecurringFrequency } from "@/types/database";

export type UpcomingPaymentSource = "debt" | "credit_account" | "credit_account_cutoff" | "recurring_transaction";

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

/**
 * El ancla de una transacción recurrente es su propia columna `date`
 * (sección 3.2/4 del doc); aquí se proyecta la próxima ocurrencia real
 * probando `steps` = 0, 1, 2... SIEMPRE contra ese mismo ancla inmutable
 * (vía `advanceRecurringDate`, que recalcula el clamp de día desde cero en
 * cada llamada) hasta llegar a hoy o después — a diferencia del cron
 * (Fase 8), que encadena `next_occurrence_date` paso a paso, aquí no hay
 * ningún valor persistido que encadenar, así que proyectar desde el ancla
 * original evita que un mes corto de por medio deje el día recortado para
 * siempre en los meses largos siguientes.
 */
function nextRecurringDate(
  anchorDate: string,
  frequency: RecurringFrequency,
  intervalDays: number | null,
  today: Date
): Date {
  const todayMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  let steps = 0;
  let candidateStr = anchorDate.slice(0, 10);
  let candidate = new Date(`${candidateStr}T00:00:00Z`);

  while (candidate.getTime() < todayMidnight.getTime() && steps < 10_000) {
    steps++;
    candidateStr = advanceRecurringDate(anchorDate, frequency, intervalDays, steps);
    candidate = new Date(`${candidateStr}T00:00:00Z`);
  }
  return candidate;
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
  cutoff_day?: number | null;
  minimum_payment?: number;
}

interface RecurringTransactionLike {
  id: string;
  note: string | null;
  amount: number;
  date: string;
  recurring_frequency: RecurringFrequency | null;
  recurring_interval_days: number | null;
  recurring_end_date: string | null;
}

/**
 * Zona de alertas de próximos pagos del Dashboard (sección 3.4.1): unifica
 * tres fuentes de vencimientos — deudas/préstamos personales por `due_day`,
 * tarjetas de crédito (por `payment_due_day` Y, como evento independiente,
 * su `cutoff_day`) y transacciones recurrentes — en una sola lista ordenada
 * por cercanía.
 */
export function getUpcomingPayments(
  input: {
    debts?: DebtLike[];
    recurringTransactions?: RecurringTransactionLike[];
  },
  today: Date = new Date(),
  withinDays: number = 5
): UpcomingPayment[] {
  const { debts = [], recurringTransactions = [] } = input;
  const upcoming: UpcomingPayment[] = [];

  for (const debt of debts) {
    if (debt.type === "credit_card") {
      if (debt.payment_due_day) {
        upcoming.push(
          toUpcoming(
            `debt:${debt.id}`,
            "credit_account",
            debt.name,
            debt.minimum_payment ?? null,
            nextMonthlyDueDate(debt.payment_due_day, today),
            today
          )
        );
      }
      if (debt.cutoff_day) {
        upcoming.push(
          toUpcoming(
            `debt:${debt.id}:cutoff`,
            "credit_account_cutoff",
            `${debt.name} · Fecha de corte`,
            null,
            nextMonthlyDueDate(debt.cutoff_day, today),
            today
          )
        );
      }
    } else if (debt.due_day) {
      upcoming.push(
        toUpcoming(`debt:${debt.id}`, "debt", debt.name, debt.minimum_payment ?? null, nextMonthlyDueDate(debt.due_day, today), today)
      );
    }
  }

  for (const tx of recurringTransactions) {
    if (!tx.recurring_frequency) continue;
    const next = nextRecurringDate(tx.date, tx.recurring_frequency, tx.recurring_interval_days, today);
    if (tx.recurring_end_date) {
      const [ey, em, ed] = tx.recurring_end_date.slice(0, 10).split("-").map(Number);
      const end = new Date(Date.UTC(ey, em - 1, ed));
      if (next.getTime() > end.getTime()) continue;
    }
    upcoming.push(
      toUpcoming(`recurring_transaction:${tx.id}`, "recurring_transaction", tx.note || "Movimiento recurrente", tx.amount, next, today)
    );
  }

  return upcoming.filter((p) => p.daysUntil <= withinDays).sort((a, b) => a.daysUntil - b.daysUntil);
}
