"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createGoalSchema, goalContributionSchema, updateGoalSchema } from "@/lib/validations/goal";

export type ActionState = { error?: string } | null;

export async function createGoal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createGoalSchema.safeParse({
    name: formData.get("name"),
    target_amount: formData.get("target_amount"),
    target_date: formData.get("target_date"),
    account_id: formData.get("account_id") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    name: parsed.data.name,
    target_amount: parsed.data.target_amount,
    target_date: parsed.data.target_date,
    account_id: parsed.data.account_id ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return null;
}

export async function updateGoal(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = updateGoalSchema.safeParse({
    name: formData.get("name"),
    target_amount: formData.get("target_amount"),
    target_date: formData.get("target_date"),
    account_id: formData.get("account_id") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({
      name: parsed.data.name,
      target_amount: parsed.data.target_amount,
      target_date: parsed.data.target_date,
      account_id: parsed.data.account_id ?? null,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return null;
}

export async function deleteGoal(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return null;
}

export async function createGoalContribution(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = goalContributionSchema.safeParse({
    goal_id: formData.get("goal_id"),
    account_id: formData.get("account_id"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    note: formData.get("note") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_goal_contribution", {
    p_goal_id: parsed.data.goal_id,
    p_account_id: parsed.data.account_id,
    p_amount: parsed.data.amount,
    p_date: parsed.data.date,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return null;
}

export async function deleteGoalContribution(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_goal_contribution", { p_id: id });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return null;
}
