import { z } from "zod";

export const createAccountSchema = z
  .object({
    name: z.string().min(1, "El nombre es obligatorio").max(80),
    type: z.enum(["cash", "debit", "credit", "investment", "savings"]),
    bank_name: z.string().max(80).optional().nullable(),
    initial_balance: z.coerce.number().min(0, "El saldo inicial no puede ser negativo"),
    credit_limit: z.coerce.number().min(0).optional().nullable(),
    interest_rate: z.coerce.number().min(0).optional().nullable(),
    minimum_payment: z.coerce.number().min(0).optional().nullable(),
    cutoff_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
    payment_due_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
  })
  .refine((data) => data.type === "credit" || !data.credit_limit, {
    message: "El límite de crédito solo aplica a cuentas de crédito",
    path: ["credit_limit"],
  });

export const updateAccountSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(80),
  bank_name: z.string().max(80).optional().nullable(),
  credit_limit: z.coerce.number().min(0).optional().nullable(),
  interest_rate: z.coerce.number().min(0).optional().nullable(),
  minimum_payment: z.coerce.number().min(0).optional().nullable(),
  cutoff_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
  payment_due_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
});
