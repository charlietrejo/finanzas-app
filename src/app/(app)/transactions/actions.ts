"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transactionFormSchema, loanGivenFormSchema } from "@/lib/validations/transaction";
import { advanceRecurringDate } from "@/lib/recurring";
import type { TransactionFormValues } from "@/lib/validations/transaction";

export type ActionState = { error?: string } | null;

function splitPayWith(value: FormDataEntryValue | null): { account_id: string | null; debt_id: string | null } {
  if (typeof value !== "string" || !value.includes(":")) return { account_id: null, debt_id: null };
  const [kind, id] = value.split(":");
  return kind === "debt" ? { account_id: null, debt_id: id } : { account_id: id, debt_id: null };
}

/**
 * Fase 8 del doc: next_occurrence_date se calcula aquí (una sola fuente de
 * verdad en TS, src/lib/recurring.ts) y se pasa a la RPC ya resuelto — la
 * RPC nunca hace aritmética de fechas, solo persiste el valor recibido.
 */
function computeNextOccurrenceDate(d: TransactionFormValues): string | null {
  if (!d.is_recurring || !d.recurring_frequency) return null;
  return advanceRecurringDate(d.date, d.recurring_frequency, d.recurring_interval_days ?? null);
}

function parseFormData(formData: FormData) {
  const { account_id, debt_id } = splitPayWith(formData.get("pay_with"));
  const isRecurring = formData.get("is_recurring") === "on";
  return transactionFormSchema.safeParse({
    type: formData.get("type"),
    account_id,
    debt_id,
    to_account_id: formData.get("to_account_id") || null,
    category_id: formData.get("category_id") || null,
    merchant_id: formData.get("merchant_id") || null,
    amount: formData.get("amount"),
    date: formData.get("date"),
    note: formData.get("note") || null,
    tags: (formData.get("tags") as string | null)
      ?.split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    is_recurring: isRecurring,
    recurring_frequency: isRecurring ? formData.get("recurring_frequency") || null : null,
    recurring_interval_days: isRecurring ? formData.get("recurring_interval_days") || null : null,
    recurring_end_date: isRecurring ? formData.get("recurring_end_date") || null : null,
    recurring_is_automatic: isRecurring ? formData.get("recurring_is_automatic") !== "false" : true,
  });
}

export async function createTransaction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_transaction", {
    p_account_id: d.account_id ?? null,
    p_debt_id: d.debt_id ?? null,
    p_type: d.type,
    p_amount: d.amount,
    p_date: d.date,
    p_category_id: d.category_id ?? null,
    p_merchant_id: d.merchant_id ?? null,
    p_to_account_id: d.to_account_id ?? null,
    p_note: d.note ?? null,
    p_tags: d.tags ?? [],
    p_is_recurring: d.is_recurring ?? false,
    p_recurring_frequency: d.recurring_frequency ?? null,
    p_recurring_interval_days: d.recurring_interval_days ?? null,
    p_recurring_end_date: d.recurring_end_date ?? null,
    p_next_occurrence_date: computeNextOccurrenceDate(d),
    p_recurring_is_automatic: d.recurring_is_automatic ?? true,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/debts");
  return null;
}

export async function updateTransaction(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_transaction", {
    p_id: id,
    p_account_id: d.account_id ?? null,
    p_debt_id: d.debt_id ?? null,
    p_type: d.type,
    p_amount: d.amount,
    p_date: d.date,
    p_category_id: d.category_id ?? null,
    p_merchant_id: d.merchant_id ?? null,
    p_to_account_id: d.to_account_id ?? null,
    p_note: d.note ?? null,
    p_tags: d.tags ?? [],
    p_is_recurring: d.is_recurring ?? false,
    p_recurring_frequency: d.recurring_frequency ?? null,
    p_recurring_interval_days: d.recurring_interval_days ?? null,
    p_recurring_end_date: d.recurring_end_date ?? null,
    p_next_occurrence_date: computeNextOccurrenceDate(d),
    p_recurring_is_automatic: d.recurring_is_automatic ?? true,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/debts");
  return null;
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_transaction", { p_id: id });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/debts");
  return null;
}

/**
 * Sección 3.4.2 del doc: cuando la categoría elegida en el formulario de
 * movimientos es "Préstamo", el submit pasa por aquí en vez de
 * createTransaction — crea el gasto normal Y el registro en loans_given de
 * forma atómica (create_loan_given, 021_loans_given.sql).
 */
export async function createLoanGiven(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { account_id, debt_id } = splitPayWith(formData.get("pay_with"));
  const parsed = loanGivenFormSchema.safeParse({
    account_id,
    debt_id,
    category_id: formData.get("category_id"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    borrower_name: formData.get("borrower_name"),
    expected_return_date: formData.get("expected_return_date") || null,
    note: formData.get("note") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_loan_given", {
    p_account_id: d.account_id ?? null,
    p_debt_id: d.debt_id ?? null,
    p_amount: d.amount,
    p_date: d.date,
    p_category_id: d.category_id,
    p_borrower_name: d.borrower_name,
    p_expected_return_date: d.expected_return_date ?? null,
    p_note: d.note ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/debts");
  revalidatePath("/loans");
  return null;
}

/**
 * Secciones 3.2/3.4.1 del doc: botón "Registrar ahora" del Dashboard, para
 * confirmar a mano la ocurrencia de una plantilla recurrente MANUAL
 * (recurring_is_automatic=false) — crea la transacción real (is_recurring
 * =false) y avanza next_occurrence_date de la plantilla, de forma atómica
 * (confirm_recurring_occurrence, 024_recurring_is_automatic.sql). El cron
 * de generate-recurring nunca toca una plantilla manual: este es el ÚNICO
 * camino por el que su next_occurrence_date avanza.
 */
export async function confirmRecurringOccurrence(
  templateId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { account_id, debt_id } = splitPayWith(formData.get("pay_with"));
  const parsed = transactionFormSchema.safeParse({
    type: formData.get("type"),
    account_id,
    debt_id,
    to_account_id: null,
    category_id: formData.get("category_id") || null,
    merchant_id: formData.get("merchant_id") || null,
    amount: formData.get("amount"),
    date: formData.get("date"),
    note: formData.get("note") || null,
    tags: (formData.get("tags") as string | null)
      ?.split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    is_recurring: false,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: template, error: templateError } = await supabase
    .from("transactions")
    .select("next_occurrence_date, recurring_frequency, recurring_interval_days")
    .eq("id", templateId)
    .single();
  if (templateError || !template?.next_occurrence_date || !template.recurring_frequency) {
    return { error: "Plantilla recurrente no encontrada" };
  }

  const nextOccurrenceDate = advanceRecurringDate(
    template.next_occurrence_date,
    template.recurring_frequency,
    template.recurring_interval_days
  );

  const { error } = await supabase.rpc("confirm_recurring_occurrence", {
    p_template_id: templateId,
    p_next_occurrence_date: nextOccurrenceDate,
    p_account_id: d.account_id ?? null,
    p_debt_id: d.debt_id ?? null,
    p_type: d.type,
    p_amount: d.amount,
    p_date: d.date,
    p_category_id: d.category_id ?? null,
    p_merchant_id: d.merchant_id ?? null,
    p_note: d.note ?? null,
    p_tags: d.tags ?? [],
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/debts");
  return null;
}

export async function createCategory(name: string, type: "income" | "expense") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data, error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, name, type })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/transactions");
  return { data };
}
