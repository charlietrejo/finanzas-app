"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transactionFormSchema } from "@/lib/validations/transaction";
import type { RecurringRule } from "@/types/database";

export type ActionState = { error?: string } | null;

function splitPayWith(value: FormDataEntryValue | null): { account_id: string | null; debt_id: string | null } {
  if (typeof value !== "string" || !value.includes(":")) return { account_id: null, debt_id: null };
  const [kind, id] = value.split(":");
  return kind === "debt" ? { account_id: null, debt_id: id } : { account_id: id, debt_id: null };
}

function parseFormData(formData: FormData) {
  const { account_id, debt_id } = splitPayWith(formData.get("pay_with"));
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
    is_recurring: formData.get("is_recurring") === "on",
    recurring_frequency: formData.get("recurring_frequency") || null,
  });
}

function buildRecurringRule(
  isRecurring: boolean,
  frequency: "daily" | "weekly" | "monthly" | null | undefined,
  date: string
): RecurringRule | null {
  if (!isRecurring || !frequency) return null;
  return { frequency, interval: 1, next_date: date };
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
    p_recurring_rule: buildRecurringRule(d.is_recurring ?? false, d.recurring_frequency, d.date),
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
    p_recurring_rule: buildRecurringRule(d.is_recurring ?? false, d.recurring_frequency, d.date),
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
