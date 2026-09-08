import type { AccountType, TransactionType } from "@/types/database";

interface BalanceCheckInput {
  accountType: AccountType;
  currentBalance: number;
  creditLimit: number | null;
  transactionType: TransactionType;
  amount: number;
}

interface BalanceCheckResult {
  valid: boolean;
  error?: string;
  newBalance: number;
}

/**
 * Espeja la validación de saldo aplicada en la función RPC de Postgres
 * (apply_transaction_effect, supabase/migrations/005_transaction_rpc.sql):
 * cuentas no-crédito no pueden quedar en negativo; cuentas de crédito pueden
 * llegar hasta -credit_limit. Se usa para dar feedback inmediato en el
 * formulario; la validación real y autoritativa vive en la base de datos.
 */
export function checkTransactionBalance({
  accountType,
  currentBalance,
  creditLimit,
  transactionType,
  amount,
}: BalanceCheckInput): BalanceCheckResult {
  if (amount <= 0) {
    return { valid: false, error: "El monto debe ser mayor a cero", newBalance: currentBalance };
  }

  if (transactionType === "income") {
    return { valid: true, newBalance: currentBalance + amount };
  }

  // expense y transfer descuentan de la cuenta de origen
  const newBalance = currentBalance - amount;
  const isCredit = accountType === "credit";
  const floor = isCredit ? -(creditLimit ?? 0) : 0;

  if (newBalance < floor) {
    return {
      valid: false,
      error: isCredit
        ? "La operación excede el límite de crédito de la cuenta"
        : "Saldo insuficiente en la cuenta",
      newBalance,
    };
  }

  return { valid: true, newBalance };
}
