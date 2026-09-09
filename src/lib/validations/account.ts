import { z } from "zod";

export const createAccountSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(80),
  type: z.enum(["cash", "debit", "investment", "savings"]),
  bank_name: z.string().max(80).optional().nullable(),
  initial_balance: z.coerce.number().min(0, "El saldo inicial no puede ser negativo"),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(80),
  bank_name: z.string().max(80).optional().nullable(),
});
