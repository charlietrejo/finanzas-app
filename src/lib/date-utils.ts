export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function getMonthRange(month: string): { start: string; end: string } {
  const [year, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, m, 1)).toISOString().slice(0, 10);
  return { start, end };
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  month: "long",
  year: "numeric",
});

export function formatMonthLabel(month: string): string {
  const label = MONTH_LABEL_FORMATTER.format(new Date(`${month}-01T00:00:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const MONTH_SHORT_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  month: "short",
  year: "2-digit",
});

export function formatMonthShort(month: string): string {
  return MONTH_SHORT_FORMATTER.format(new Date(`${month}-01T00:00:00`)).replace(".", "");
}

export function daysBetween(a: string | Date, b: string | Date): number {
  const dateA = typeof a === "string" ? new Date(a) : a;
  const dateB = typeof b === "string" ? new Date(b) : b;
  return Math.floor((dateB.getTime() - dateA.getTime()) / 86_400_000);
}

/** Últimos `count` meses en orden ascendente, terminando en `endMonth` (default: mes actual). */
export function getLastMonths(count: number, endMonth: string = getCurrentMonth()): string[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(shiftMonth(endMonth, -i));
  }
  return months;
}
