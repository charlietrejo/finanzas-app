import { z } from "zod";

export const createBudgetSchema = z.object({
  category_id: z.string().uuid("Selecciona una categoría"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Mes inválido"),
  amount_limit: z.coerce.number().positive("El límite debe ser mayor a cero"),
  alert_threshold_pct: z.coerce.number().int().min(1).max(100),
});

export const updateBudgetSchema = z.object({
  amount_limit: z.coerce.number().positive("El límite debe ser mayor a cero"),
  alert_threshold_pct: z.coerce.number().int().min(1).max(100),
});
