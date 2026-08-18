import { connection } from "next/server";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listCategoriesServer } from "@/services/finance.server";
import { CategoriesClient } from "./categories-client";

// QA-41 — Server Component: carga categorías en el servidor (cookies de sesión
// vía createSupabaseServerClient) y pasa los datos iniciales al client, para
// que el contenido sea visible aunque la hidratación esté bloqueada por la CSP
// estricta (script-src 'self').
export default async function CategoriesPage() {
  await connection();

  let initialCategories: Awaited<ReturnType<typeof listCategoriesServer>> = [];
  let error: string | null = null;

  try {
    initialCategories = await listCategoriesServer();
  } catch (err) {
    error =
      err instanceof Error
        ? `No se pudieron cargar tus categorías (${err.message}).`
        : "Ocurrió un error inesperado.";
  }

  if (error) {
    return (
      <div className="space-y-6 p-2 pb-28 sm:p-4 sm:pb-4">
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p className="text-sm text-slate-600">{error}</p>
            <Link href="/categories">
              <Button>Reintentar</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <CategoriesClient initialCategories={initialCategories} />;
}
