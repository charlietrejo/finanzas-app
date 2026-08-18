import { connection } from "next/server";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  listAccountsServer,
  listCategoriesServer,
  listTransactionsServer,
} from "@/services/finance.server";
import { AnalyticsClient } from "./analytics-client";

// QA-41 — Server Component: carga transacciones, categorías y cuentas en el
// servidor (cookies de sesión vía createSupabaseServerClient) y pasa los datos
// iniciales al client, para que el reporte sea visible aunque la hidratación
// esté bloqueada por la CSP estricta (script-src 'self').
export default async function AnalyticsPage() {
  await connection();

  let initialTransactions: Awaited<ReturnType<typeof listTransactionsServer>> = [];
  let initialCategories: Awaited<ReturnType<typeof listCategoriesServer>> = [];
  let initialAccounts: Awaited<ReturnType<typeof listAccountsServer>> = [];
  let error: string | null = null;

  try {
    [initialTransactions, initialCategories, initialAccounts] = await Promise.all([
      listTransactionsServer(),
      listCategoriesServer(),
      listAccountsServer(),
    ]);
  } catch (err) {
    error =
      err instanceof Error
        ? `No se pudo cargar el análisis (${err.message}).`
        : "Ocurrió un error inesperado.";
  }

  if (error) {
    return (
      <div className="space-y-6 p-2 pb-28 sm:p-4 sm:pb-4">
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p className="text-sm text-slate-600">{error}</p>
            <Link href="/analytics">
              <Button>Reintentar</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AnalyticsClient
      initialTransactions={initialTransactions}
      initialCategories={initialCategories}
      initialAccounts={initialAccounts}
    />
  );
}
