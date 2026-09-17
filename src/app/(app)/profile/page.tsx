import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ProfileClient } from "./profile-client";
import type { Category } from "@/types/database";
import packageJson from "../../../../package.json";

// Fila para exportar CSV/JSON: unbounded (sin .limit) a propósito — es un
// backup manual, no la lista paginada de Movimientos. Pero el query que la
// llena (con sus 5 joins) solo se dispara al hacer clic en exportar
// (exportTransactions en actions.ts), no en cada visita a esta pantalla —
// aquí solo se pide el conteo, mucho más liviano, para el texto "Respaldo
// manual de tus N movimientos".
export interface ExportTransactionRow {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  date: string;
  note: string | null;
  tags: string[];
  account: { name: string } | null;
  debt: { name: string } | null;
  to_account: { name: string } | null;
  category: { name: string } | null;
  merchant: { name: string } | null;
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const initialTheme = themeCookie === "dark" ? "dark" : "light";

  const [{ data: categories }, { count: transactionCount }] = await Promise.all([
    supabase.from("categories").select("*").order("type", { ascending: true }).order("name", { ascending: true }),
    supabase.from("transactions").select("id", { count: "exact", head: true }),
  ]);

  return (
    <ProfileClient
      userId={user.id}
      email={user.email ?? ""}
      fullName={(user.user_metadata?.full_name as string | undefined) ?? ""}
      initialTheme={initialTheme}
      categories={(categories ?? []) as Category[]}
      transactionCount={transactionCount ?? 0}
      appVersion={packageJson.version}
    />
  );
}
