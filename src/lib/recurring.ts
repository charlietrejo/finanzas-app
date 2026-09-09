import type { RecurringFrequency } from "@/types/database";

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Avanza `anchorDate` (YYYY-MM-DD) `steps` periodos según
 * `recurring_frequency` (Fase 8 / sección 4 del doc). Fuente única de
 * verdad para la aritmética de recurrencias: la usa la Server Action al
 * fijar el `next_occurrence_date` inicial de una transacción recurrente
 * (`steps=1`, encadenado desde `date`), la ruta del cron al avanzarlo tras
 * generar una ocurrencia (`steps=1`, encadenado desde el
 * `next_occurrence_date` anterior — así lo describe el doc: "sumando el
 * intervalo"; un ancla en día 31 puede ir recortándose a 28/30 en meses
 * cortos sucesivos, limitación aceptada, igual que en sistemas de
 * facturación reales), y `upcoming-payments.ts` para las alertas de
 * próximos pagos, ahí SIEMPRE recalculando `steps` distintos desde el
 * mismo `anchorDate` inmutable (nunca encadenando resultados), para
 * proyectar varios periodos vencidos sin arrastrar un recorte de mes corto
 * a los meses largos siguientes.
 */
export function advanceRecurringDate(
  anchorDate: string,
  frequency: RecurringFrequency,
  intervalDays: number | null,
  steps: number = 1
): string {
  const [y, m, d] = anchorDate.slice(0, 10).split("-").map(Number);

  if (frequency === "monthly" || frequency === "annual") {
    const monthStep = (frequency === "annual" ? 12 : 1) * steps;
    const totalMonths = y * 12 + (m - 1) + monthStep;
    const year = Math.floor(totalMonths / 12);
    const monthIndex = ((totalMonths % 12) + 12) % 12;
    const day = Math.min(d, daysInMonth(year, monthIndex));
    return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
  }

  const stepDays = (frequency === "weekly" ? 7 : Math.max(1, intervalDays ?? 1)) * steps;
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + stepDays);
  return date.toISOString().slice(0, 10);
}
