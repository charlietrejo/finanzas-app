import type { Account, Debt } from "@/types/database";
import { DEBT_TYPE_LABELS } from "@/lib/constants/debt-types";

export type UnifiedDebtSource = "debt" | "credit_account";

/**
 * Forma común para mostrar en una sola lista (sección 6 del doc) tanto
 * préstamos/deudas personales (`debts`) como cuentas de crédito (`accounts`),
 * que desde la corrección de diseño son la única fuente de verdad de tarjetas.
 * Los nombres `current_balance`/`interest_rate` se conservan tal cual para
 * poder reusar `sortSnowball`/`sortAvalanche` (debt-strategy.ts) sin cambios.
 */
export interface UnifiedDebtItem {
  key: string;
  source: UnifiedDebtSource;
  name: string;
  typeLabel: string;
  current_balance: number;
  interest_rate: number;
  minimum_payment: number;
  due_day: number | null;
  raw: Debt | Account;
}

export function buildUnifiedDebts(debts: Debt[], accounts: Account[]): UnifiedDebtItem[] {
  const fromDebts: UnifiedDebtItem[] = debts
    .filter((d) => d.archived_at === null)
    .map((d) => ({
      key: `debt:${d.id}`,
      source: "debt",
      name: d.name,
      typeLabel: DEBT_TYPE_LABELS[d.type],
      current_balance: d.current_balance,
      interest_rate: d.interest_rate,
      minimum_payment: d.minimum_payment,
      due_day: d.due_day,
      raw: d,
    }));

  const fromCreditAccounts: UnifiedDebtItem[] = accounts
    .filter((a) => a.type === "credit")
    .map((a) => ({
      key: `credit_account:${a.id}`,
      source: "credit_account",
      name: a.name,
      typeLabel: "Tarjeta",
      current_balance: Math.max(0, -a.current_balance),
      interest_rate: a.interest_rate ?? 0,
      minimum_payment: a.minimum_payment ?? 0,
      due_day: a.payment_due_day,
      raw: a,
    }));

  return [...fromDebts, ...fromCreditAccounts];
}
