import { connection } from "next/server";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listAccountsServer, listDebtsServer } from "@/services/finance.server";
import { AccountsClient } from "./accounts-client";

// QA-41 — Server Component: carga cuentas y deudas en el servidor (cookies de
// sesión vía createSupabaseServerClient) y pasa los datos iniciales al client.
// Así el contenido es visible aunque la hidratación esté bloqueada por la CSP
// estricta (script-src 'self'). Las mutaciones quedan en AccountsClient.
export default async function AccountsPage() {
  await connection();

  let initialAccounts: Awaited<ReturnType<typeof listAccountsServer>> = [];
  let initialDebts: Awaited<ReturnType<typeof listDebtsServer>> = [];
  let error: string | null = null;

  try {
    [initialAccounts, initialDebts] = await Promise.all([
      listAccountsServer(),
      listDebtsServer(),
    ]);
  } catch (err) {
    error =
      err instanceof Error
        ? `No se pudieron cargar tus cuentas (${err.message}).`
        : "Ocurrió un error inesperado.";
  }

  if (error) {
    return (
      <div className="space-y-6 p-2 pb-28 sm:p-4 sm:pb-4">
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p className="text-sm text-slate-600">{error}</p>
            <Link href="/accounts">
              <Button>Reintentar</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AccountsClient initialAccounts={initialAccounts} initialDebts={initialDebts} />;
}
