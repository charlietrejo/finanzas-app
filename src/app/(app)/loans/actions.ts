"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loanRepaymentFormSchema } from "@/lib/validations/transaction";

export type ActionState = { error?: string } | null;

/**
 * Sección 3.4.2 del doc: un cobro (total o parcial) se registra como un
 * ingreso normal ligado a un préstamo específico — create_loan_repayment
 * (021_loans_given.sql) aplica el efecto de ingreso, inserta la transacción,
 * y reduce loans_given.current_balance de forma atómica.
 */
export async function createLoanRepayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loanRepaymentFormSchema.safeParse({
    loan_given_id: formData.get("loan_given_id"),
    account_id: formData.get("account_id"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    note: formData.get("note") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_loan_repayment", {
    p_loan_given_id: d.loan_given_id,
    p_account_id: d.account_id,
    p_amount: d.amount,
    p_date: d.date,
    p_note: d.note ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/loans");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  return null;
}
