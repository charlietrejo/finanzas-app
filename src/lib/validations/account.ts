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

// Sección 3.1 del doc ("Ajustar saldo"): el saldo real que el usuario ve en
// su banco, contra el que se calcula la diferencia a reconciliar.
export const adjustAccountBalanceSchema = z.object({
  real_balance: z.coerce.number().min(0, "El saldo no puede ser negativo"),
});
