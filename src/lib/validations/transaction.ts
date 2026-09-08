import { z } from "zod";

export const transactionFormSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    account_id: z.string().uuid("Selecciona una cuenta"),
    to_account_id: z.string().uuid().optional().nullable(),
    category_id: z.string().uuid().optional().nullable(),
    merchant_id: z.string().uuid().optional().nullable(),
    amount: z.coerce.number().positive("El monto debe ser mayor a cero"),
    date: z.string().min(1, "La fecha es obligatoria"),
    note: z.string().max(500).optional().nullable(),
    tags: z.array(z.string().min(1).max(30)).max(10).optional().default([]),
    is_recurring: z.boolean().optional().default(false),
    recurring_frequency: z.enum(["daily", "weekly", "monthly"]).optional().nullable(),
  })
  .refine((data) => data.type !== "transfer" || !!data.to_account_id, {
    message: "Selecciona la cuenta destino",
    path: ["to_account_id"],
  })
  .refine((data) => data.type !== "transfer" || data.to_account_id !== data.account_id, {
    message: "La cuenta destino debe ser distinta a la de origen",
    path: ["to_account_id"],
  });

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
