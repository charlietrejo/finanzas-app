import { connection } from "next/server";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  listAccountsServer,
  listCategoriesServer,
  listDebtsServer,
  listTransactionsServer,
} from "@/services/finance.server";
import { TransactionsClient } from "./transactions-client";

// QA-41 — Server Component: carga transacciones, cuentas, categorías y deudas
// en el servidor (cookies de sesión vía createSupabaseServerClient) y pasa los
// datos iniciales al client, para que el contenido sea visible aunque la
// hidratación esté bloqueada por la CSP estricta (script-src 'self').
export default async function TransactionsPage() {
  await connection();

  let initialTransactions: Awaited<ReturnType<typeof listTransactionsServer>> = [];
  let initialAccounts: Awaited<ReturnType<typeof listAccountsServer>> = [];
  let initialCategories: Awaited<ReturnType<typeof listCategoriesServer>> = [];
  let initialDebts: Awaited<ReturnType<typeof listDebtsServer>> = [];
  let error: string | null = null;

  try {
    [initialTransactions, initialAccounts, initialCategories, initialDebts] = await Promise.all([
      listTransactionsServer(),
      listAccountsServer(),
      listCategoriesServer(),
      listDebtsServer(),
    ]);
  } catch (err) {
    error =
      err instanceof Error
        ? `No se pudieron cargar tus movimientos (${err.message}).`
        : "Ocurrió un error inesperado.";
  }

  if (error) {
    return (
      <div className="space-y-6 p-2 pb-28 sm:p-4 sm:pb-4">
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p className="text-sm text-slate-600">{error}</p>
            <Link href="/transactions">
              <Button>Reintentar</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TransactionsClient
      initialTransactions={initialTransactions}
      initialAccounts={initialAccounts}
      initialCategories={initialCategories}
      initialDebts={initialDebts}
    />
  );
}
