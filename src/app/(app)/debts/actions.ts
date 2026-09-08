"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createDebtSchema, debtPaymentSchema, updateDebtSchema } from "@/lib/validations/debt";

export type ActionState = { error?: string } | null;

export async function createDebt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createDebtSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    principal: formData.get("principal"),
    interest_rate: formData.get("interest_rate"),
    minimum_payment: formData.get("minimum_payment"),
    due_day: formData.get("due_day") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from("debts").insert({
    user_id: user.id,
    name: parsed.data.name,
    type: parsed.data.type,
    principal: parsed.data.principal,
    current_balance: parsed.data.principal,
    interest_rate: parsed.data.interest_rate,
    minimum_payment: parsed.data.minimum_payment,
    due_day: parsed.data.due_day ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  return null;
}

export async function updateDebt(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = updateDebtSchema.safeParse({
    name: formData.get("name"),
    interest_rate: formData.get("interest_rate"),
    minimum_payment: formData.get("minimum_payment"),
    due_day: formData.get("due_day") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("debts")
    .update({
      name: parsed.data.name,
      interest_rate: parsed.data.interest_rate,
      minimum_payment: parsed.data.minimum_payment,
      due_day: parsed.data.due_day ?? null,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  return null;
}

export async function deleteDebt(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("debts").delete().eq("id", id);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/debts");
  revalidatePath("/dashboard");
  return null;
}

export async function createDebtPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = debtPaymentSchema.safeParse({
    debt_id: formData.get("debt_id"),
    account_id: formData.get("account_id"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    note: formData.get("note") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_debt_payment", {
    p_debt_id: parsed.data.debt_id,
    p_account_id: parsed.data.account_id,
    p_amount: parsed.data.amount,
    p_date: parsed.data.date,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/debts");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return null;
}

export async function deleteDebtPayment(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_debt_payment", { p_id: id });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/debts");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return null;
}
