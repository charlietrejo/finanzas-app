import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

// QA-37 — AuthGuard como Server Component. Valida la sesión en el servidor
// (cookies de sesión vía createSupabaseServerClient) y redirige a /login si no
// hay usuario. Esto evita depender de la hidratación de React (bloqueada por la
// CSP estricta script-src 'self') para mostrar el contenido protegido: el
// dashboard ya es Server Component y su HTML se envía aunque no hidrate.
// El middleware sigue como primera línea de defensa; esto es defensa en profundidad.
export async function AuthGuard({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
