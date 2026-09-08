import { z } from "zod";

export const createGoalSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(80),
  target_amount: z.coerce.number().positive("El monto objetivo debe ser mayor a cero"),
  target_date: z.string().min(1, "La fecha límite es obligatoria"),
  account_id: z.string().uuid().optional().nullable(),
});

export const updateGoalSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(80),
  target_amount: z.coerce.number().positive("El monto objetivo debe ser mayor a cero"),
  target_date: z.string().min(1, "La fecha límite es obligatoria"),
  account_id: z.string().uuid().optional().nullable(),
});

export const goalContributionSchema = z.object({
  goal_id: z.string().uuid("Selecciona una meta"),
  account_id: z.string().uuid("Selecciona una cuenta"),
  amount: z.coerce.number().positive("El monto debe ser mayor a cero"),
  date: z.string().min(1, "La fecha es obligatoria"),
  note: z.string().max(500).optional().nullable(),
});
