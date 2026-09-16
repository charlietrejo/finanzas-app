"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adjustAccountBalanceSchema, createAccountSchema, updateAccountSchema } from "@/lib/validations/account";

export type ActionState = { error?: string } | null;

export async function createAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createAccountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    bank_name: formData.get("bank_name") || null,
    initial_balance: formData.get("initial_balance"),
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
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return null;
}

/**
 * Sección 3.1 del doc ("Ajustar saldo — reconciliación manual"):
 * adjust_account_balance (023_account_balance_adjustment.sql) calcula la
 * diferencia contra el saldo actual y crea el movimiento de ajuste
 * (is_adjustment=true) de forma atómica.
 */
export async function adjustAccountBalance(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = adjustAccountBalanceSchema.safeParse({
    real_balance: formData.get("real_balance"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_account_balance", {
    p_account_id: id,
    p_real_balance: parsed.data.real_balance,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath("/budgets");
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
