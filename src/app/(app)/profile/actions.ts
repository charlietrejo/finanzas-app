"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { createCategory as createCategoryShared } from "@/app/(app)/transactions/actions";

export type ActionState = { error?: string; success?: string } | null;

/** Sección 3.7 del doc: nombre para mostrar, guardado en user_metadata (sin tabla nueva). */
export async function updateDisplayName(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("full_name") ?? "").trim();
  if (name.length === 0) return { error: "El nombre no puede estar vacío" };
  if (name.length > 80) return { error: "Máximo 80 caracteres" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { success: "Nombre actualizado" };
}

/** Reusa exactamente la validación de contraseña de registro/recuperación (auth.ts). */
export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  return { success: "Contraseña actualizada" };
}

// createCategory ya existe en transactions/actions.ts (mismo patrón que ya
// usa budgets-client.tsx) — se envuelve en una función async propia en vez
// de reexportarla como const: un archivo "use server" solo admite exportar
// funciones async declaradas, no un valor asignado por const.
export async function createCategory(name: string, type: "income" | "expense") {
  return createCategoryShared(name, type);
}

export async function updateCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) return { error: "El nombre no puede estar vacío" };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").update({ name }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/profile");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  return { success: "Categoría actualizada" };
}

export async function deleteCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/profile");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  return { data: true };
}
