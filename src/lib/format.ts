// Helpers puros compartidos entre Server y Client Components (sin APIs del
// navegador). Extraídos de dashboard/page.tsx para poder usarlos tanto en el
// Server Component del dashboard como en la isla client AnimatedMoney (QA-37).

export function formatMoney(amount: number) {
  return amount.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
}

export function monthShort(d: Date) {
  return d.toLocaleString("es-MX", { month: "short" });
}

export function formatDay(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Hoy";
  if (sameDay(date, yesterday)) return "Ayer";
  return `${date.getDate()} ${monthShort(date)}`;
}

export function isCurrentMonth(dateStr: string) {
  const now = new Date();
  const [year, month] = dateStr.split("-").map(Number);
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

export function transactionLabel(type: string) {
  const labels: Record<string, string> = {
    INCOME: "Ingreso",
    EXPENSE: "Gasto",
    TRANSFER: "Transferencia",
    DEBT_PAYMENT: "Pago de deuda",
  };
  return labels[type] ?? type;
}

export const typeBadgeClass: Record<string, string> = {
  INCOME: "bg-emerald-50 text-emerald-700",
  EXPENSE: "bg-rose-50 text-rose-700",
  TRANSFER: "bg-sky-50 text-sky-700",
  DEBT_PAYMENT: "bg-violet-50 text-violet-700",
};
