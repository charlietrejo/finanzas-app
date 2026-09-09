export interface UpcomingDebtPayment {
  debtId: string;
  name: string;
  dueDate: string;
  daysUntil: number;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * `due_day` es un día del mes (1-31, sección 3.4: "si se pone el 2, será el
 * día 2 de cada mes"). Calcula la próxima ocurrencia desde `today`, con el
 * día limitado a los días reales del mes (ej. due_day=31 en febrero -> 28/29).
 */
function nextDueDate(dueDay: number, today: Date): Date {
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
 * Recordatorios visuales de pago (sección 5 del doc: "recordatorios in-app...
 * al abrir la app en vez de push"). Devuelve las deudas con `due_day`
 * configurado cuyo próximo vencimiento cae dentro de `withinDays`, ordenadas
 * por cercanía.
 */
export function getUpcomingDebtPayments(
  debts: { id: string; name: string; due_day: number | null }[],
  today: Date = new Date(),
  withinDays: number = 7
): UpcomingDebtPayment[] {
  const todayMidnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const upcoming: UpcomingDebtPayment[] = [];
  for (const debt of debts) {
    if (!debt.due_day) continue;
    const due = nextDueDate(debt.due_day, today);
    const daysUntil = Math.round((due.getTime() - todayMidnight.getTime()) / 86_400_000);
    if (daysUntil <= withinDays) {
      upcoming.push({ debtId: debt.id, name: debt.name, dueDate: due.toISOString().slice(0, 10), daysUntil });
    }
  }

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}
