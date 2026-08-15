import { supabase } from "@/lib/supabase/browser";
import type { Account, AccountType, Category, CategoryType, Transaction, TransactionType } from "@/types";

export type AccountPayload = {
  name: string;
  type: AccountType;
  initialBalance: number;
  currentBalance?: number;
  debtId?: string | null;
};

type CategoryPayload = {
  name: string;
  type: CategoryType;
  parentId?: string | null;
  icon?: string;
  color?: string;
};

type TransactionPayload = {
  type: TransactionType;
  amount: number;
  description: string;
  notes?: string;
  accountId: string;
  categoryId?: string | null;
  destinationAccountId?: string | null;
  transactionDate: string;
  debtId?: string | null;
  idempotencyKey?: string | null;
};

type BudgetPayload = {
  categoryId: string;
  amount: number;
  period: "MONTHLY" | "WEEKLY" | "YEARLY";
  startDate: string;
};

type GoalPayload = {
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string | null;
};

function normalizeAmount(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function getClient() {
  if (!supabase) {
    throw new Error("La configuración de Supabase no está disponible.");
  }

  return supabase;
}

async function getCurrentUserId() {
  const client = getClient();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new Error("No hay una sesión activa.");
  }

  return data.user.id;
}

// Rate limiting para operaciones autenticadas (migración 014).
// Identidad = auth.uid() (la RPC lo usa internamente); no depende de IP ni de
// headers del cliente. Bypass en desarrollo vía RATE_LIMIT_DISABLED.
const RATE_LIMIT_DISABLED =
  process.env.NODE_ENV !== "production" &&
  process.env.RATE_LIMIT_DISABLED === "true";

async function assertRateLimit(bucket: string, max: number, windowSeconds: number) {
  if (RATE_LIMIT_DISABLED) return;
  const { error } = await getClient().rpc("check_rate_limit", {
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    throw new Error(
      error.message || "Has realizado demasiadas operaciones. Inténtalo de nuevo más tarde."
    );
  }
}

function assertValidAmount(amount: number) {
  if (
    amount === null ||
    amount === undefined ||
    Number.isNaN(amount) ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error("El monto debe ser un número positivo mayor a cero.");
  }
}

async function applyTransactionEffect(transaction: Transaction) {
  const { error } = await getClient().rpc("apply_transaction_effect", {
    p_action: "apply",
    p_id: transaction.id,
    p_user_id: transaction.user_id,
    p_account_id: transaction.account_id,
    p_type: transaction.type,
    p_amount: transaction.amount,
    p_debt_id: transaction.debt_id ?? null,
    p_destination_account_id: transaction.destination_account_id ?? null,
  });

  if (error) {
    throw new Error(error.message || "No se pudo aplicar el movimiento.");
  }
}

async function revertTransactionEffect(transaction: Transaction) {
  const { error } = await getClient().rpc("apply_transaction_effect", {
    p_action: "revert",
    p_id: transaction.id,
    p_user_id: transaction.user_id,
    p_account_id: transaction.account_id,
    p_type: transaction.type,
    p_amount: transaction.amount,
    p_debt_id: transaction.debt_id ?? null,
    p_destination_account_id: transaction.destination_account_id ?? null,
  });

  if (error) {
    throw new Error(error.message || "No se pudo revertir el movimiento.");
  }
}

export async function listAccounts() {
  const client = getClient();
  const { data, error } = await client.from("accounts").select("*").order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Account[];
}

export async function createAccount(payload: AccountPayload) {
  const userId = await getCurrentUserId();
  await assertRateLimit("account_create", 10, 60);
  const client = getClient();

  const { data, error } = await client
    .from("accounts")
    .insert({
      user_id: userId,
      name: payload.name,
      type: payload.type,
      initial_balance: payload.initialBalance,
      current_balance: payload.currentBalance ?? payload.initialBalance,
      debt_id: payload.debtId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Account;
}

export async function updateAccount(id: string, payload: AccountPayload) {
  const client = getClient();
  const { data, error } = await client
    .from("accounts")
    .update({
      name: payload.name,
      type: payload.type,
      initial_balance: payload.initialBalance,
      current_balance: payload.currentBalance ?? payload.initialBalance,
      debt_id: payload.debtId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Account;
}

export async function deleteAccount(id: string) {
  const client = getClient();

  const { data: relatedTransactions, error: relatedError } = await client
    .from("transactions")
    .select("id")
    .or(`account_id.eq.${id},destination_account_id.eq.${id}`)
    .limit(1);

  if (relatedError) throw relatedError;
  if ((relatedTransactions ?? []).length > 0) {
    throw new Error(
      "No puedes eliminar esta cuenta porque tiene movimientos asociados. Elimina primero sus movimientos."
    );
  }

  const { error } = await client.from("accounts").delete().eq("id", id);
  if (error) throw error;
}

export async function listCategories() {
  const client = getClient();
  const { data, error } = await client.from("categories").select("*").order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function createCategory(payload: CategoryPayload) {
  const userId = await getCurrentUserId();
  const client = getClient();

  const { data, error } = await client
    .from("categories")
    .insert({
      user_id: userId,
      name: payload.name,
      type: payload.type,
      parent_id: payload.parentId ?? null,
      icon: payload.icon ?? "tag",
      color: payload.color ?? "#64748b",
      is_default: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

export async function updateCategory(id: string, payload: CategoryPayload) {
  const client = getClient();
  const { data, error } = await client
    .from("categories")
    .update({
      name: payload.name,
      type: payload.type,
      parent_id: payload.parentId ?? null,
      icon: payload.icon ?? "tag",
      color: payload.color ?? "#64748b",
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(id: string) {
  const client = getClient();
  const { data: relatedTransactions, error: relatedError } = await client
    .from("transactions")
    .select("id")
    .eq("category_id", id)
    .limit(1);

  if (relatedError) throw relatedError;
  if ((relatedTransactions ?? []).length > 0) {
    throw new Error("No se puede eliminar una categoría con transacciones asociadas.");
  }

  const { error } = await client.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function listTransactions() {
  const client = getClient();
  const { data, error } = await client.from("transactions").select("*").order("transaction_date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function createTransaction(payload: TransactionPayload) {
  assertValidAmount(payload.amount);
  await assertRateLimit("tx_create", 30, 60);

  const userId = await getCurrentUserId();
  const client = getClient();

  // Si la transacción es un gasto y la cuenta es una tarjeta vinculada a una deuda,
  // validamos que la compra no exceda el límite y asociamos la deuda automáticamente.
  let insertDebtId: string | null = payload.debtId ?? null;
  if (payload.type === "EXPENSE") {
    const { data: account, error: accountError } = await client
      .from("accounts")
      .select("type, debt_id")
      .eq("id", payload.accountId)
      .single();

    if (accountError || !account) {
      throw accountError ?? new Error("No se encontró la cuenta");
    }

    if (account.type === "CREDIT_CARD") {
      if (account.debt_id) {
        const { data: debt, error: debtError } = await client
          .from("debts")
          .select("current_balance, initial_amount")
          .eq("id", account.debt_id)
          .single();

        if (debtError || !debt) {
          throw debtError ?? new Error("No se encontró la deuda asociada a la tarjeta");
        }

        if (normalizeAmount(debt.current_balance) + normalizeAmount(payload.amount) > normalizeAmount(debt.initial_amount)) {
          throw new Error("La compra excede el límite de la tarjeta.");
        }

        insertDebtId = account.debt_id;
      } else {
        // Tarjeta sin deuda vinculada: no se permite cargar el saldo en la
        // cuenta porque crearía un estado inconsistente (deuda duplicada si
        // después se enlaza una deuda). Se requiere deuda asociada.
        throw new Error(
          "La tarjeta de crédito no tiene una deuda asociada. Créala desde la sección Deudas."
        );
      }
    } else {
      // Cuenta bancaria: el gasto no puede exceder el saldo disponible.
      const { data: origin, error: originError } = await client
        .from("accounts")
        .select("current_balance")
        .eq("id", payload.accountId)
        .single();

      if (originError || !origin) {
        throw originError ?? new Error("No se encontró la cuenta");
      }

      if (normalizeAmount(payload.amount) > normalizeAmount(origin.current_balance)) {
        throw new Error("No tienes saldo suficiente en esta cuenta para realizar este gasto.");
      }
    }
  }

  // Validación de pago de deuda: el monto no puede exceder la deuda actual.
  if (payload.type === "DEBT_PAYMENT") {
    const debtId = payload.debtId ?? null;
    if (!debtId) {
      throw new Error("Selecciona la deuda que deseas pagar.");
    }
    const { data: debt, error: debtError } = await client
      .from("debts")
      .select("current_balance")
      .eq("id", debtId)
      .single();

    if (debtError || !debt) {
      throw debtError ?? new Error("No se encontró la deuda que deseas pagar.");
    }

    if (normalizeAmount(payload.amount) > normalizeAmount(debt.current_balance)) {
      throw new Error("El pago no puede ser mayor a la deuda actual.");
    }

    // BUG 1: el saldo de la cuenta pagadora debe alcanzar para el pago.
    const { data: payerAccount, error: payerError } = await client
      .from("accounts")
      .select("current_balance")
      .eq("id", payload.accountId)
      .single();

    if (payerError || !payerAccount) {
      throw payerError ?? new Error("No se encontró la cuenta");
    }

    if (normalizeAmount(payload.amount) > normalizeAmount(payerAccount.current_balance)) {
      throw new Error("No tienes saldo suficiente en esta cuenta para realizar este pago.");
    }
  }

  // Validación de transferencia: el saldo de la cuenta de origen debe alcanzar
  // y el destino debe ser válido y distinto a la cuenta de origen.
  if (payload.type === "TRANSFER") {
    if (!payload.destinationAccountId) {
      throw new Error("Selecciona la cuenta de destino para la transferencia.");
    }
    if (payload.destinationAccountId === payload.accountId) {
      throw new Error("La cuenta de origen y destino no pueden ser la misma.");
    }
    const { data: origin, error: originError } = await client
      .from("accounts")
      .select("current_balance")
      .eq("id", payload.accountId)
      .single();

    if (originError || !origin) {
      throw originError ?? new Error("No se encontró la cuenta de origen.");
    }

    if (normalizeAmount(payload.amount) > normalizeAmount(origin.current_balance)) {
      throw new Error("Saldo insuficiente en la cuenta de origen para realizar la transferencia.");
    }
  }

  const { data, error } = await client
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: payload.accountId,
      category_id: payload.categoryId ?? null,
      debt_id: insertDebtId ?? null,
      type: payload.type,
      amount: payload.amount,
      description: payload.description,
      notes: payload.notes ?? null,
      transaction_date: payload.transactionDate,
      destination_account_id: payload.destinationAccountId ?? null,
      transfer_group_id: null,
      idempotency_key: payload.idempotencyKey ?? null,
    })
    .select()
    .single();

  if (error) {
    // Conflicto de idempotencia: la misma (user_id, idempotency_key) ya existe.
    // Recuperamos la transacción previa y la devolvemos SIN re-ejecutar el
    // efecto financiero (aplica exactamente una vez por operación).
    if (error.code === "23505" && payload.idempotencyKey) {
      const { data: existing, error: fetchError } = await client
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("idempotency_key", payload.idempotencyKey)
        .single();
      if (existing && !fetchError) {
        return existing as Transaction;
      }
    }
    throw error;
  }

  const transaction = data as Transaction;
  // El efecto financiero ocurre en una RPC transaccional. Si falla, borramos la
  // fila recién insertada para no dejar una transacción sin efecto aplicado.
  try {
    await applyTransactionEffect(transaction);
  } catch (effectError) {
    await client.from("transactions").delete().eq("id", transaction.id);
    throw effectError;
  }
  return transaction;
}

export async function updateTransaction(id: string, payload: TransactionPayload) {
  assertValidAmount(payload.amount);
  await assertRateLimit("tx_write", 60, 60);

  const client = getClient();
  const { data: existing, error: existingError } = await client
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    throw existingError ?? new Error("No se encontró la transacción");
  }

  const existingTx = existing as Transaction;

  // Validaciones atómicas: se ejecutan ANTES de revertir para no dejar la
  // operación parcialmente aplicada si alguna falla.
  let updateDebtId: string | null = payload.debtId ?? null;

  if (payload.type === "DEBT_PAYMENT") {
    const debtId = payload.debtId ?? null;
    if (!debtId) {
      throw new Error("Selecciona la deuda que deseas pagar.");
    }

    // Saldo disponible en la cuenta que recibirá el pago. Si la cuenta no
    // cambió, recuperamos el monto del pago actualmente aplicado.
    const { data: payerAccount, error: payerError } = await client
      .from("accounts")
      .select("current_balance")
      .eq("id", payload.accountId)
      .single();

    if (payerError || !payerAccount) {
      throw payerError ?? new Error("No se encontró la cuenta");
    }

    const saldoActual = normalizeAmount(payerAccount.current_balance);
    const mismaCuenta = existingTx.account_id === payload.accountId;
    const disponibleCuenta = mismaCuenta
      ? saldoActual + normalizeAmount(existingTx.amount)
      : saldoActual;

    if (normalizeAmount(payload.amount) > disponibleCuenta) {
      throw new Error("No tienes saldo suficiente en esta cuenta para realizar este pago.");
    }

    // El pago nuevo no puede exceder la deuda actual más el monto ya pagado.
    const { data: debt, error: debtError } = await client
      .from("debts")
      .select("current_balance")
      .eq("id", debtId)
      .single();

    if (debtError || !debt) {
      throw debtError ?? new Error("No se encontró la deuda que deseas pagar.");
    }

    if (
      normalizeAmount(payload.amount) >
      normalizeAmount(debt.current_balance) + normalizeAmount(existingTx.amount)
    ) {
      throw new Error("El pago no puede ser mayor a la deuda actual.");
    }
  }

  if (payload.type === "TRANSFER") {
    if (!payload.destinationAccountId) {
      throw new Error("Selecciona la cuenta de destino para la transferencia.");
    }
    if (payload.destinationAccountId === payload.accountId) {
      throw new Error("La cuenta de origen y destino no pueden ser la misma.");
    }
    const { data: origin, error: originError } = await client
      .from("accounts")
      .select("current_balance")
      .eq("id", payload.accountId)
      .single();

    if (originError || !origin) {
      throw originError ?? new Error("No se encontró la cuenta de origen.");
    }

    const saldoActual = normalizeAmount(origin.current_balance);
    const mismaCuenta = existingTx.account_id === payload.accountId;
    const disponible = mismaCuenta
      ? saldoActual + normalizeAmount(existingTx.amount)
      : saldoActual;

    if (normalizeAmount(payload.amount) > disponible) {
      throw new Error("Saldo insuficiente en la cuenta de origen para realizar la transferencia.");
    }
  }

  if (payload.type === "EXPENSE") {
    const { data: account, error: accountError } = await client
      .from("accounts")
      .select("type, debt_id")
      .eq("id", payload.accountId)
      .single();

    if (accountError || !account) {
      throw accountError ?? new Error("No se encontró la cuenta");
    }

    if (account.type === "CREDIT_CARD") {
      if (account.debt_id) {
        const { data: debt, error: debtError } = await client
          .from("debts")
          .select("current_balance, initial_amount")
          .eq("id", account.debt_id)
          .single();

        if (debtError || !debt) {
          throw debtError ?? new Error("No se encontró la deuda asociada a la tarjeta");
        }

        if (
          normalizeAmount(debt.current_balance) + normalizeAmount(payload.amount) >
          normalizeAmount(debt.initial_amount)
        ) {
          throw new Error("La compra excede el límite de la tarjeta.");
        }

        updateDebtId = account.debt_id;
      } else {
        // Tarjeta sin deuda vinculada: no se permite cargar el saldo en la
        // cuenta porque crearía un estado inconsistente (deuda duplicada si
        // después se enlaza una deuda). Se requiere deuda asociada.
        throw new Error(
          "La tarjeta de crédito no tiene una deuda asociada. Créala desde la sección Deudas."
        );
      }
    } else {
      // Cuenta bancaria: el gasto no puede exceder el saldo disponible.
      // Al editar, el saldo se restaura temporalmente al revertir el gasto
      // anterior, por eso se suma existingTx.amount si la cuenta no cambia.
      const { data: origin, error: originError } = await client
        .from("accounts")
        .select("current_balance")
        .eq("id", payload.accountId)
        .single();

      if (originError || !origin) {
        throw originError ?? new Error("No se encontró la cuenta");
      }

      const saldoActual = normalizeAmount(origin.current_balance);
      const mismaCuenta = existingTx.account_id === payload.accountId;
      const disponible = mismaCuenta
        ? saldoActual + normalizeAmount(existingTx.amount)
        : saldoActual;

      if (normalizeAmount(payload.amount) > disponible) {
        throw new Error("No tienes saldo suficiente en esta cuenta para realizar este gasto.");
      }
    }
  }

  // Solo después de validar todo, revertimos el efecto anterior y aplicamos el nuevo.
  // Si el nuevo apply falla (p. ej. condición de carrera en saldos que la
  // validación previa no anticipó), restauramos el estado exacto previo:
  // reaplicamos el efecto original y dejamos la fila sin cambios. Así nunca
  // queda el sistema en un estado parcialmente modificado.
  await revertTransactionEffect(existingTx);

  const { data, error } = await client
    .from("transactions")
    .update({
      account_id: payload.accountId,
      category_id: payload.categoryId ?? null,
      debt_id: updateDebtId ?? null,
      type: payload.type,
      amount: payload.amount,
      description: payload.description,
      notes: payload.notes ?? null,
      transaction_date: payload.transactionDate,
      destination_account_id: payload.destinationAccountId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    // El update falló: reaplicamos el efecto original para no dejar saldos a medias.
    await applyTransactionEffect(existingTx);
    throw error;
  }

  const transaction = data as Transaction;
  try {
    await applyTransactionEffect(transaction);
  } catch (applyError) {
    // Rollback completo: deshacer el cambio de la fila y reaplicar el efecto previo.
    await client
      .from("transactions")
      .update({
        account_id: existingTx.account_id,
        category_id: existingTx.category_id,
        debt_id: existingTx.debt_id ?? null,
        type: existingTx.type,
        amount: existingTx.amount,
        description: existingTx.description,
        notes: existingTx.notes ?? null,
        transaction_date: existingTx.transaction_date,
        destination_account_id: existingTx.destination_account_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    await applyTransactionEffect(existingTx);
    throw applyError;
  }
  return transaction;
}

export async function deleteTransaction(id: string) {
  await assertRateLimit("tx_write", 60, 60);

  const client = getClient();
  const { data: existing, error: existingError } = await client
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    throw existingError ?? new Error("No se encontró la transacción");
  }

  // Eliminación atómica: la RPC borra la fila y revierte el efecto financiero
  // dentro de una misma transacción SQL (migración 013). Así no queda ninguna
  // ventana de inconsistencia si el borrado o la reversión fallan por separado.
  const { error } = await getClient().rpc("delete_transaction_effect", {
    p_id: id,
    p_user_id: (existing as Transaction).user_id,
    p_account_id: (existing as Transaction).account_id,
    p_type: (existing as Transaction).type,
    p_amount: (existing as Transaction).amount,
    p_debt_id: (existing as Transaction).debt_id ?? null,
    p_destination_account_id: (existing as Transaction).destination_account_id ?? null,
  });

  if (error) {
    throw new Error(error.message || "No se pudo eliminar el movimiento.");
  }
}

export async function listBudgets() {
  const client = getClient();
  const { data, error } = await client.from("budgets").select("*").order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as import("@/types").Budget[];
}

export async function createBudget(payload: BudgetPayload) {
  const userId = await getCurrentUserId();
  const client = getClient();

  const { data, error } = await client
    .from("budgets")
    .insert({
      user_id: userId,
      category_id: payload.categoryId,
      amount: payload.amount,
      period: payload.period,
      start_date: payload.startDate,
    })
    .select()
    .single();

  if (error) throw error;
  return data as import("@/types").Budget;
}

export async function updateBudget(id: string, payload: BudgetPayload) {
  const client = getClient();
  const { data, error } = await client
    .from("budgets")
    .update({
      category_id: payload.categoryId,
      amount: payload.amount,
      period: payload.period,
      start_date: payload.startDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as import("@/types").Budget;
}

export async function deleteBudget(id: string) {
  const client = getClient();
  const { error } = await client.from("budgets").delete().eq("id", id);
  if (error) throw error;
}

export async function listGoals() {
  const client = getClient();
  const { data, error } = await client.from("goals").select("*").order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as import("@/types").Goal[];
}

export async function createGoal(payload: GoalPayload) {
  const userId = await getCurrentUserId();
  const client = getClient();

  const { data, error } = await client
    .from("goals")
    .insert({
      user_id: userId,
      name: payload.name,
      target_amount: payload.targetAmount,
      current_balance: payload.currentAmount,
      target_date: payload.targetDate ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as import("@/types").Goal;
}

export async function updateGoal(id: string, payload: GoalPayload) {
  const client = getClient();
  const { data, error } = await client
    .from("goals")
    .update({
      name: payload.name,
      target_amount: payload.targetAmount,
      current_balance: payload.currentAmount,
      target_date: payload.targetDate ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as import("@/types").Goal;
}

export async function deleteGoal(id: string) {
  const client = getClient();
  const { error } = await client.from("goals").delete().eq("id", id);
  if (error) throw error;
}

export async function listDebts() {
  const client = getClient();

  const { data, error } = await client
    .from("debts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as import("@/types").Debt[];
}


export async function createDebt(payload: {
  name: string;
  type: string;
  initialAmount: number;
  currentBalance: number;
  dueDate?: string | null;
}) {
  const userId = await getCurrentUserId();
  await assertRateLimit("debt_create", 10, 60);
  const client = getClient();

  const { data, error } = await client
    .from("debts")
    .insert({
      user_id: userId,
      name: payload.name,
      type: payload.type,
      initial_amount: payload.initialAmount,
      current_balance: payload.currentBalance,
      due_date: payload.dueDate ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}


export async function updateDebt(
  id: string,
  payload: {
    name?: string;
    type?: string;
    initialAmount?: number;
    currentBalance?: number;
    dueDate?: string | null;
  }
) {
  const client = getClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.name !== undefined) {
    updateData.name = payload.name;
  }

  if (payload.type !== undefined) {
    updateData.type = payload.type;
  }

  if (payload.initialAmount !== undefined) {
    updateData.initial_amount = payload.initialAmount;
  }

  if (payload.currentBalance !== undefined) {
    updateData.current_balance = payload.currentBalance;
  }

  if (payload.dueDate !== undefined) {
    updateData.due_date = payload.dueDate;
  }

  const { data, error } = await client
    .from("debts")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}


export async function deleteDebt(id: string) {
  const client = getClient();

  const { data: relatedTransactions, error: relatedError } = await client
    .from("transactions")
    .select("id")
    .eq("debt_id", id)
    .limit(1);

  if (relatedError) throw relatedError;
  if ((relatedTransactions ?? []).length > 0) {
    throw new Error(
      "No puedes eliminar esta deuda porque tiene movimientos asociados. Elimina primero sus movimientos."
    );
  }

  const { error } = await client
    .from("debts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}