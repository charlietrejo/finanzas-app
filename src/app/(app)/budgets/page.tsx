import { connection } from "next/server";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listBudgetsServer, listCategoriesServer } from "@/services/finance.server";
import { BudgetsClient } from "./budgets-client";

// QA-41 — Server Component: carga presupuestos y categorías en el servidor
// (cookies de sesión vía createSupabaseServerClient) y pasa los datos iniciales
// al client, para que el contenido sea visible aunque la hidratación esté
// bloqueada por la CSP estricta (script-src 'self').
export default async function BudgetsPage() {
  await connection();

  let initialBudgets: Awaited<ReturnType<typeof listBudgetsServer>> = [];
  let initialCategories: Awaited<ReturnType<typeof listCategoriesServer>> = [];
  let error: string | null = null;

  try {
    [initialBudgets, initialCategories] = await Promise.all([
      listBudgetsServer(),
      listCategoriesServer(),
    ]);
  } catch (err) {
    error =
      err instanceof Error
        ? `No se pudieron cargar los presupuestos (${err.message}).`
        : "Ocurrió un error inesperado.";
  }

  if (error) {
    return (
      <div className="space-y-6 p-2 pb-28 sm:p-4 sm:pb-4">
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p className="text-sm text-slate-600">{error}</p>
            <Link href="/budgets">
              <Button>Reintentar</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <BudgetsClient initialBudgets={initialBudgets} initialCategories={initialCategories} />;
}
