"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAccountSchema, updateAccountSchema } from "@/lib/validations/account";

export type ActionState = { error?: string } | null;

export async function createAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createAccountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    bank_name: formData.get("bank_name") || null,
    initial_balance: formData.get("initial_balance"),
    credit_limit: formData.get("credit_limit") || null,
    interest_rate: formData.get("interest_rate") || null,
    minimum_payment: formData.get("minimum_payment") || null,
    cutoff_day: formData.get("cutoff_day") || null,
    payment_due_day: formData.get("payment_due_day") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: parsed.data.name,
    type: parsed.data.type,
    bank_name: parsed.data.bank_name ?? null,
    initial_balance: parsed.data.initial_balance,
    current_balance: parsed.data.initial_balance,
    credit_limit: parsed.data.type === "credit" ? parsed.data.credit_limit ?? null : null,
    interest_rate: parsed.data.type === "credit" ? parsed.data.interest_rate ?? null : null,
    minimum_payment: parsed.data.type === "credit" ? parsed.data.minimum_payment ?? null : null,
    cutoff_day: parsed.data.type === "credit" ? parsed.data.cutoff_day ?? null : null,
    payment_due_day: parsed.data.type === "credit" ? parsed.data.payment_due_day ?? null : null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return null;
}

export async function updateAccount(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = updateAccountSchema.safeParse({
    name: formData.get("name"),
    bank_name: formData.get("bank_name") || null,
    credit_limit: formData.get("credit_limit") || null,
    interest_rate: formData.get("interest_rate") || null,
    minimum_payment: formData.get("minimum_payment") || null,
    cutoff_day: formData.get("cutoff_day") || null,
    payment_due_day: formData.get("payment_due_day") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({
      name: parsed.data.name,
      bank_name: parsed.data.bank_name ?? null,
      credit_limit: parsed.data.credit_limit ?? null,
      interest_rate: parsed.data.interest_rate ?? null,
      minimum_payment: parsed.data.minimum_payment ?? null,
      cutoff_day: parsed.data.cutoff_day ?? null,
      payment_due_day: parsed.data.payment_due_day ?? null,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return null;
}

export async function deleteAccount(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return null;
}
