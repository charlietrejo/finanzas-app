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
