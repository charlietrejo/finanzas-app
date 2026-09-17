import { z } from "zod";

export const transactionFormSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    account_id: z.string().uuid().optional().nullable(),
    debt_id: z.string().uuid().optional().nullable(),
    to_account_id: z.string().uuid().optional().nullable(),
    category_id: z.string().uuid().optional().nullable(),
    merchant_id: z.string().uuid().optional().nullable(),
    amount: z.coerce.number().positive("El monto debe ser mayor a cero"),
    date: z.string().min(1, "La fecha es obligatoria"),
    note: z.string().max(500).optional().nullable(),
    tags: z.array(z.string().min(1).max(30)).max(10).optional().default([]),
    is_recurring: z.boolean().optional().default(false),
    recurring_frequency: z.enum(["weekly", "monthly", "annual", "custom"]).optional().nullable(),
    recurring_interval_days: z.coerce.number().int().positive().optional().nullable(),
    recurring_end_date: z.string().optional().nullable(),
    // Secciones 3.2/3.4.1 del doc: domiciliado/automático (default, el cron
    // la genera sola) vs. manual (el cron la ignora, solo recordatorio).
    recurring_is_automatic: z.boolean().optional().default(true),
  })
  .refine((data) => data.type !== "transfer" || !!data.to_account_id, {
    message: "Selecciona la cuenta destino",
    path: ["to_account_id"],
  })
  .refine((data) => data.type !== "transfer" || data.to_account_id !== data.account_id, {
    message: "La cuenta destino debe ser distinta a la de origen",
    path: ["to_account_id"],
  })
  .refine((data) => data.type === "expense" || !!data.account_id, {
    message: "Selecciona una cuenta",
    path: ["account_id"],
  })
  .refine((data) => data.type === "expense" || !data.debt_id, {
    message: "Los ingresos y transferencias no pueden pagarse con una tarjeta",
    path: ["debt_id"],
  })
  .refine((data) => data.type !== "expense" || !!data.account_id !== !!data.debt_id, {
    message: "Elige una cuenta o una tarjeta para el gasto, no ambas ni ninguna",
    path: ["account_id"],
  })
  .refine((data) => data.type === "expense" || !data.merchant_id, {
    message: "El comercio solo aplica a gastos",
    path: ["merchant_id"],
  })
  .refine((data) => data.type === "expense" || (data.tags?.length ?? 0) === 0, {
    message: "Las etiquetas solo aplican a gastos",
    path: ["tags"],
  })
  .refine((data) => data.type !== "transfer" || !data.category_id, {
    message: "Las transferencias no llevan categoría",
    path: ["category_id"],
  })
  .refine((data) => data.type !== "transfer" || !data.is_recurring, {
    message: "Una transferencia no puede ser recurrente",
    path: ["is_recurring"],
  })
  .refine((data) => !data.is_recurring || !!data.recurring_frequency, {
    message: "Selecciona la frecuencia de la recurrencia",
    path: ["recurring_frequency"],
  })
  .refine((data) => data.recurring_frequency !== "custom" || !!data.recurring_interval_days, {
    message: "Indica cada cuántos días se repite",
    path: ["recurring_interval_days"],
  });

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

// Sección 3.4.2 del doc: la misma "cuenta o tarjeta, no ambas ni ninguna"
// que un gasto normal (transactionFormSchema), más los dos campos que
// dispara la categoría especial "Préstamo".
export const loanGivenFormSchema = z
  .object({
    account_id: z.string().uuid().optional().nullable(),
    debt_id: z.string().uuid().optional().nullable(),
    category_id: z.string().uuid(),
    amount: z.coerce.number().positive("El monto debe ser mayor a cero"),
    date: z.string().min(1, "La fecha es obligatoria"),
    borrower_name: z.string().trim().min(1, "Indica a quién se le prestó").max(120),
    expected_return_date: z.string().optional().nullable(),
    note: z.string().max(500).optional().nullable(),
  })
  .refine((data) => !!data.account_id !== !!data.debt_id, {
    message: "Elige una cuenta o una tarjeta para el préstamo, no ambas ni ninguna",
    path: ["account_id"],
  });

export type LoanGivenFormValues = z.infer<typeof loanGivenFormSchema>;

export const loanRepaymentFormSchema = z.object({
  loan_given_id: z.string().uuid(),
  account_id: z.string().uuid(),
  amount: z.coerce.number().positive("El monto debe ser mayor a cero"),
  date: z.string().min(1, "La fecha es obligatoria"),
  note: z.string().max(500).optional().nullable(),
});

export type LoanRepaymentFormValues = z.infer<typeof loanRepaymentFormSchema>;
