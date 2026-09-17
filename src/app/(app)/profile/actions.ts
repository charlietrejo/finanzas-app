"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { createCategory as createCategoryShared } from "@/app/(app)/transactions/actions";
import type { ExportTransactionRow } from "./page";

export type ActionState = { error?: string; success?: string } | null;

/**
 * Sección 3.7 del doc ("Datos: exportar CSV/JSON"): el historial completo de
 * movimientos solo se consulta al hacer clic en un botón de exportar, no en
 * cada visita a Cuenta (page.tsx solo pide el conteo) — evita traer todo el
 * historial con sus joins en cada carga de una pantalla de alto tráfico
 * (accesible desde el avatar en cualquier página).
 */
export async function exportTransactions(): Promise<ExportTransactionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, type, amount, date, note, tags, account:accounts!transactions_account_id_fkey(name), debt:debts(name), to_account:accounts!transactions_to_account_id_fkey(name), category:categories(name), merchant:merchants(name)"
    )
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ExportTransactionRow[];
}

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
  // Secciones 3.6/3.7/3.8: el checkbox solo se renderiza para categorías de
  // gasto (ver profile-client.tsx) — en una de ingreso llega ausente, que
  // aquí se lee como false, su default y único valor con sentido para ese tipo.
  const isEssential = formData.get("is_essential") === "on";

  const supabase = await createClient();
  const { error } = await supabase.from("categories").update({ name, is_essential: isEssential }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/profile");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  revalidatePath("/reports");
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
