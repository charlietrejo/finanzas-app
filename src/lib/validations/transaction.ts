import { z } from "zod";

export const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: z.coerce.number().positive("El importe debe ser mayor a cero"),
  description: z.string().min(1, "La descripción es obligatoria"),
  categoryId: z.string().optional(),
  accountId: z.string().min(1, "Selecciona una cuenta"),
  transactionDate: z.string().min(1, "Selecciona una fecha"),
  notes: z.string().optional(),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;
