import { supabase } from "@/lib/supabase/browser";
import type { Account, AccountType, Category, CategoryType, Transaction, TransactionType } from "@/types";

type AccountPayload = {
  name: string;
  type: AccountType;
  initialBalance: number;
  currentBalance?: number;
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

type DebtPayload = {
  name: string;
  type: "CREDIT_CARD" | "LOAN" | "MORTGAGE" | "OTHER";
  initialAmount: number;
  currentBalance?: number;
  dueDate?: string | null;
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

async function updateAccountBalance(accountId: string, delta: number) {
  const client = getClient();

  const { data: accountData, error: accountError } = await client
    .from("accounts")
    .select("current_balance")
    .eq("id", accountId)
    .single();

  if (accountError || !accountData) {
    throw accountError ?? new Error("No se encontró la cuenta");
  }

  const nextBalance = Math.max(
    0,
    normalizeAmount(accountData.current_balance) + delta
  );

  const { error } = await client
    .from("accounts")
    .update({
      current_balance: nextBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  if (error) {
    throw error;
  }
}

async function updateDebtBalance(debtId: string, delta: number) {
  const client = getClient();

  const { data: debt, error } = await client
    .from("debts")
    .select("current_balance")
    .eq("id", debtId)
    .single();

  if (error || !debt) {
    throw error ?? new Error("No se encontró la deuda");
  }

  const nextBalance = Math.max(
    0,
    normalizeAmount(debt.current_balance) + delta
  );

  const { error: updateError } = await client
    .from("debts")
    .update({
      current_balance: nextBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", debtId);

  if (updateError) {
    throw updateError;
  }
}

async function applyTransactionEffect(transaction: Transaction) {

  if (
    transaction.type === "DEBT_PAYMENT" &&
    transaction.debt_id
  ) {

    await updateAccountBalance(
      transaction.account_id,
      -normalizeAmount(transaction.amount)
    );

    await updateDebtBalance(
      transaction.debt_id,
      -normalizeAmount(transaction.amount)
    );

    return;
  }

  if (transaction.type === "INCOME") {
    await updateAccountBalance(
      transaction.account_id,
      normalizeAmount(transaction.amount)
    );
    return;
  }

  if (transaction.type === "EXPENSE") {
    await updateAccountBalance(
      transaction.account_id,
      -normalizeAmount(transaction.amount)
    );
    return;
  }

  if (transaction.type === "TRANSFER") {
    await updateAccountBalance(
      transaction.account_id,
      -normalizeAmount(transaction.amount)
    );

    if (transaction.destination_account_id) {
      await updateAccountBalance(
        transaction.destination_account_id,
        normalizeAmount(transaction.amount)
      );
    }
  }
}

async function revertTransactionEffect(transaction: Transaction) {
    if (transaction.type === "DEBT_PAYMENT") {
    await updateAccountBalance(
      transaction.account_id,
      normalizeAmount(transaction.amount)
    );

    if (transaction.debt_id) {
      await updateDebtBalance(
        transaction.debt_id,
        normalizeAmount(transaction.amount)
      );
    }
  }
  
  if (transaction.type === "INCOME") {
    await updateAccountBalance(transaction.account_id, -normalizeAmount(transaction.amount));
    return;
  }

  if (transaction.type === "EXPENSE") {
    await updateAccountBalance(transaction.account_id, normalizeAmount(transaction.amount));
    return;
  }

  if (transaction.type === "TRANSFER") {
    await updateAccountBalance(transaction.account_id, normalizeAmount(transaction.amount));
    if (transaction.destination_account_id) {
      await updateAccountBalance(transaction.destination_account_id, -normalizeAmount(transaction.amount));
    }
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
  const client = getClient();

  const { data, error } = await client
    .from("accounts")
    .insert({
      user_id: userId,
      name: payload.name,
      type: payload.type,
      initial_balance: payload.initialBalance,
      current_balance: payload.currentBalance ?? payload.initialBalance,
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

  const userId = await getCurrentUserId();
  const client = getClient();

  const { data, error } = await client
    .from("transactions")
    .insert({
      user_id: userId,
      account_id: payload.accountId,
      category_id: payload.categoryId ?? null,
      debt_id: payload.debtId ?? null,
      type: payload.type,
      amount: payload.amount,
      description: payload.description,
      notes: payload.notes ?? null,
      transaction_date: payload.transactionDate,
      destination_account_id: payload.destinationAccountId ?? null,
      transfer_group_id: null,
    })
    .select()
    .single();

  if (error) throw error;

  const transaction = data as Transaction;
  await applyTransactionEffect(transaction);
  return transaction;
}

export async function updateTransaction(id: string, payload: TransactionPayload) {
  const client = getClient();
  const { data: existing, error: existingError } = await client
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    throw existingError ?? new Error("No se encontró la transacción");
  }

  await revertTransactionEffect(existing as Transaction);

  const { data, error } = await client
    .from("transactions")
    .update({
      account_id: payload.accountId,
      category_id: payload.categoryId ?? null,
      debt_id: payload.debtId ?? null,
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

  if (error) throw error;

  const transaction = data as Transaction;
  await applyTransactionEffect(transaction);
  return transaction;
}

export async function deleteTransaction(id: string) {
  const client = getClient();
  const { data: existing, error: existingError } = await client
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (existingError || !existing) {
    throw existingError ?? new Error("No se encontró la transacción");
  }

  await revertTransactionEffect(existing as Transaction);

  const { error } = await client.from("transactions").delete().eq("id", id);
  if (error) throw error;
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
    currentBalance: number;
  }
) {
  const client = getClient();

  const { data, error } = await client
    .from("debts")
    .update({
      current_balance: payload.currentBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}


export async function deleteDebt(id: string) {
  const client = getClient();

  const { error } = await client
    .from("debts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}