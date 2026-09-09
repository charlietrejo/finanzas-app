export interface CreditCardDebt {
  accountId: string;
  name: string;
  owed: number;
  creditLimit: number | null;
}

interface AccountLike {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  credit_limit: number | null;
}

/**
 * Una cuenta de crédito con saldo negativo ES una deuda (dinero que se le
 * debe al banco), aunque viva en `accounts` y no en `debts` — el usuario la
 * crea en Cuentas para registrar sus gastos con tarjeta, pero espera verla
 * reflejada en Deudas también. No se duplica en la tabla `debts`: se deriva
 * en cada lectura a partir de `accounts.current_balance` (que ya se
 * mantiene correcto vía las RPC de transacciones/transferencias).
 */
export function getCreditCardDebts(accounts: AccountLike[]): CreditCardDebt[] {
  return accounts
    .filter((a) => a.type === "credit" && a.current_balance < 0)
    .map((a) => ({
      accountId: a.id,
      name: a.name,
      owed: -a.current_balance,
      creditLimit: a.credit_limit,
    }));
}

export function getTotalCreditCardDebt(accounts: AccountLike[]): number {
  return getCreditCardDebts(accounts).reduce((sum, d) => sum + d.owed, 0);
}
