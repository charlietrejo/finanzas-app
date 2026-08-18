import { connection } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";

// QA-41 — Server Component: resuelve el email del usuario en el servidor
// (cookies de sesión vía createSupabaseServerClient) y lo pasa al client, para
// que la pantalla sea visible aunque la hidratación esté bloqueada por la CSP
// estricta (script-src 'self'). El logout se delega a /auth/signout.
export default async function SettingsPage() {
  await connection();

  let userEmail: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
  } catch {
    userEmail = null;
  }

  return <SettingsClient userEmail={userEmail} />;
}
