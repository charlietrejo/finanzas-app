import { z } from "zod";

export const createDebtSchema = z
  .object({
    name: z.string().min(1, "El nombre es obligatorio").max(80),
    type: z.enum(["credit_card", "loan", "personal"]),
    principal: z.coerce.number().min(0, "El saldo no puede ser negativo"),
    interest_rate: z.coerce.number().min(0, "La tasa no puede ser negativa"),
    minimum_payment: z.coerce.number().min(0, "El pago mínimo no puede ser negativo"),
    due_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
    credit_limit: z.coerce.number().min(0).optional().nullable(),
    bank_name: z.string().max(80).optional().nullable(),
    cutoff_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
    payment_due_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
  })
  .refine(
    (d) => d.type === "credit_card" || (!d.credit_limit && !d.bank_name && !d.cutoff_day && !d.payment_due_day),
    { message: "Esos campos solo aplican a tarjetas de crédito", path: ["credit_limit"] }
  );

export const updateDebtSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(80),
  interest_rate: z.coerce.number().min(0, "La tasa no puede ser negativa"),
  minimum_payment: z.coerce.number().min(0, "El pago mínimo no puede ser negativo"),
  due_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
  credit_limit: z.coerce.number().min(0).optional().nullable(),
  bank_name: z.string().max(80).optional().nullable(),
  cutoff_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
  payment_due_day: z.coerce.number().int().min(1).max(31).optional().nullable(),
});

export const debtPaymentSchema = z.object({
  debt_id: z.string().uuid("Selecciona una deuda"),
  account_id: z.string().uuid("Selecciona una cuenta"),
  amount: z.coerce.number().positive("El monto debe ser mayor a cero"),
  date: z.string().min(1, "La fecha es obligatoria"),
  note: z.string().max(500).optional().nullable(),
});
