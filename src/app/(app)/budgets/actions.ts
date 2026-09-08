"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createBudgetSchema, updateBudgetSchema } from "@/lib/validations/budget";

export type ActionState = { error?: string } | null;

export async function createBudget(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createBudgetSchema.safeParse({
    category_id: formData.get("category_id"),
    month: formData.get("month"),
    amount_limit: formData.get("amount_limit"),
    alert_threshold_pct: formData.get("alert_threshold_pct"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from("budgets").insert({
    user_id: user.id,
    category_id: parsed.data.category_id,
    month: `${parsed.data.month}-01`,
    amount_limit: parsed.data.amount_limit,
    alert_threshold_pct: parsed.data.alert_threshold_pct,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe un presupuesto para esa categoría en ese mes" };
    }
    return { error: error.message };
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return null;
}

export async function updateBudget(
  id: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = updateBudgetSchema.safeParse({
    amount_limit: formData.get("amount_limit"),
    alert_threshold_pct: formData.get("alert_threshold_pct"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("budgets")
    .update({
      amount_limit: parsed.data.amount_limit,
      alert_threshold_pct: parsed.data.alert_threshold_pct,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return null;
}

export async function deleteBudget(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return null;
}
