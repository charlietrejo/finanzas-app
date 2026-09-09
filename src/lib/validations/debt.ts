import { z } from "zod";

export const createDebtSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(80),
  type: z.enum(["loan", "personal"]),
  principal: z.coerce.number().min(0, "El saldo no puede ser negativo"),
  interest_rate: z.coerce.number().min(0, "La tasa no puede ser negativa"),
  minimum_payment: z.coerce.number().min(0, "El pago mínimo no puede ser negativo"),
  due_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
});

export const updateDebtSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(80),
  interest_rate: z.coerce.number().min(0, "La tasa no puede ser negativa"),
  minimum_payment: z.coerce.number().min(0, "El pago mínimo no puede ser negativo"),
  due_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
});

export const debtPaymentSchema = z.object({
  debt_id: z.string().uuid("Selecciona una deuda"),
  account_id: z.string().uuid("Selecciona una cuenta"),
  amount: z.coerce.number().positive("El monto debe ser mayor a cero"),
  date: z.string().min(1, "La fecha es obligatoria"),
  note: z.string().max(500).optional().nullable(),
});
