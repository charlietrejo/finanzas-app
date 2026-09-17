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
  // Solo se llenan para source="recurring_transaction" (secciones 3.2/3.4.1
  // del doc): templateId identifica la plantilla para el botón "Marcar como
  // pagada"; isAutomatic decide si ese botón se muestra (solo en manuales,
  // false) o el recordatorio es puramente informativo (true).
  templateId?: string;
  isAutomatic?: boolean;
  // Solo para recurrencias MANUALES (isAutomatic=false): pagos_atrasados =
  // 1 + floor(daysLate / intervalo), sección 3.4.1 — 0 o negativo significa
  // que todavía no vence (solo está dentro de la ventana de aviso de 3
  // días); 1 = vence hoy o recién atrasado; 2+ = varios periodos sin
  // confirmar acumulados, hay que mostrar el monto acumulado.
  overdueCount?: number;
  daysLate?: number;
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
  today: Date,
  templateId?: string,
  isAutomatic?: boolean
): UpcomingPayment {
  const todayMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const daysUntil = Math.round((due.getTime() - todayMidnight.getTime()) / 86_400_000);
  return { key, source, name, amount, dueDate: due.toISOString().slice(0, 10), daysUntil, templateId, isAutomatic };
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
  // Secciones 3.2/3.4.1 del doc: opcional para no romper llamadores/tests
  // previos a esta columna — ausente se trata como automático (mismo
  // default que la columna en BD, ver 024_recurring_is_automatic.sql).
  recurring_is_automatic?: boolean;
  // Solo se usa (y solo es obligatorio en la práctica) para plantillas
  // MANUALES — sección 3.4.1: a diferencia de las automáticas (que se
  // proyectan hacia adelante desde `date`, nunca se atrasan porque el cron
  // las genera antes), una manual usa este valor tal cual está persistido,
  // sin proyectarlo, para poder quedarse "atrás" y no saltarse al siguiente
  // periodo solo porque ya pasó la fecha.
  next_occurrence_date?: string | null;
}

/** Sección 3.4.1: "intervalo_en_días" de la fórmula de pagos atrasados — una
 * aproximación simple a propósito (sin modelo calendario exacto para
 * mensual/anual), consistente con el resto del doc ("sin necesitar un
 * modelo estadístico complejo"). No se usa para calcular fechas reales
 * (eso sigue siendo advanceRecurringDate, calendario-exacto) — solo para
 * contar cuántos periodos completos ya pasaron. */
function manualIntervalDays(frequency: RecurringFrequency, intervalDays: number | null): number {
  switch (frequency) {
    case "weekly":
      return 7;
    case "monthly":
      return 30;
    case "annual":
      return 365;
    case "custom":
      return intervalDays ?? 1;
  }
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

  const todayMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  for (const tx of recurringTransactions) {
    if (!tx.recurring_frequency) continue;
    const isManual = tx.recurring_is_automatic === false;

    if (isManual) {
      // Sección 3.4.1: usa next_occurrence_date tal cual — nunca se
      // proyecta hacia adelante, para que una ocurrencia vencida se quede
      // vencida (persistente) en vez de saltarse sola al siguiente periodo.
      if (!tx.next_occurrence_date) continue;
      const [y, m, d] = tx.next_occurrence_date.slice(0, 10).split("-").map(Number);
      const due = new Date(Date.UTC(y, m - 1, d));
      if (tx.recurring_end_date) {
        const [ey, em, ed] = tx.recurring_end_date.slice(0, 10).split("-").map(Number);
        const end = new Date(Date.UTC(ey, em - 1, ed));
        if (due.getTime() > end.getTime()) continue;
      }

      const daysLate = Math.round((todayMidnight.getTime() - due.getTime()) / 86_400_000);
      const interval = manualIntervalDays(tx.recurring_frequency, tx.recurring_interval_days);
      const overdueCount = 1 + Math.floor(daysLate / interval);

      const item = toUpcoming(
        `recurring_transaction:${tx.id}`,
        "recurring_transaction",
        tx.note || "Movimiento recurrente",
        tx.amount,
        due,
        today,
        tx.id,
        false
      );
      item.overdueCount = overdueCount;
      item.daysLate = daysLate;
      upcoming.push(item);
      continue;
    }

    // Domiciliada/automática: sin cambios de comportamiento — el cron la
    // genera antes de que se atrase, así que sigue teniendo sentido
    // proyectar hacia adelante desde el ancla `date`.
    const next = nextRecurringDate(tx.date, tx.recurring_frequency, tx.recurring_interval_days, today);
    if (tx.recurring_end_date) {
      const [ey, em, ed] = tx.recurring_end_date.slice(0, 10).split("-").map(Number);
      const end = new Date(Date.UTC(ey, em - 1, ed));
      if (next.getTime() > end.getTime()) continue;
    }
    upcoming.push(
      toUpcoming(
        `recurring_transaction:${tx.id}`,
        "recurring_transaction",
        tx.note || "Movimiento recurrente",
        tx.amount,
        next,
        today,
        tx.id,
        tx.recurring_is_automatic ?? true
      )
    );
  }

  // Sección 3.4.1: los recordatorios manuales usan su PROPIA ventana fija
  // de 3 días (nunca la ventana general withinDays) y, al no tener cota
  // inferior, una vez vencidos se quedan visibles indefinidamente — solo
  // desaparecen al confirmarse (avanza next_occurrence_date) o al llegar a
  // 0 pagos pendientes.
  return upcoming
    .filter((p) => (p.source === "recurring_transaction" && p.isAutomatic === false ? p.daysUntil <= 3 : p.daysUntil <= withinDays))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
