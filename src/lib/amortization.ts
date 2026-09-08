export interface AmortizationRow {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  remainingBalance: number;
}

export interface AmortizationResult {
  rows: AmortizationRow[];
  months: number;
  neverPaysOff: boolean;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Simulador de amortización (sección 3.4): tabla de pagos mes a mes hasta
 * saldar la deuda, dado un pago mensual fijo. Es una herramienta de
 * simulación pura — no modifica debts.current_balance (solo los pagos
 * registrados via RPC lo hacen).
 */
export function buildAmortizationSchedule({
  balance,
  annualRatePct,
  monthlyPayment,
  maxMonths = 600,
}: {
  balance: number;
  annualRatePct: number;
  monthlyPayment: number;
  maxMonths?: number;
}): AmortizationResult {
  const monthlyRate = annualRatePct / 100 / 12;
  const rows: AmortizationRow[] = [];
  let remaining = balance;
  let month = 0;
  let neverPaysOff = false;

  while (remaining > 0.005 && month < maxMonths) {
    month++;
    const interest = remaining * monthlyRate;

    if (monthlyPayment <= interest) {
      neverPaysOff = true;
      break;
    }

    let principal = monthlyPayment - interest;
    let payment = monthlyPayment;
    if (principal > remaining) {
      principal = remaining;
      payment = interest + principal;
    }
    remaining -= principal;

    rows.push({
      month,
      payment: round2(payment),
      interest: round2(interest),
      principal: round2(principal),
      remainingBalance: round2(remaining),
    });
  }

  return { rows, months: rows.length, neverPaysOff };
}
