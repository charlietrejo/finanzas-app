import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// QA-42 — "Recuérdame": controla la persistencia de la cookie de sesión.
// @supabase/ssr 0.12.4 siempre fija maxAge al DEFAULT (ignora cookieOptions.maxAge),
// así que en setAll removemos maxAge cuando no se marca "recuérdame" (cookie de
// sesión que expira al cerrar el navegador) y lo fijamos a sessionMaxAge cuando sí.
// Usa la API cookieMethodsServer.setAll oficial; no es un workaround.
export async function createSupabaseServerClient(opts?: {
  sessionMaxAge?: number;
}) {
  const cookieStore = await cookies();
  const maxAge = opts?.sessionMaxAge;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const o = { ...options };
              if (maxAge !== undefined) {
                o.maxAge = maxAge;
              } else if (o.maxAge !== 0) {
                // Sin "recuérdame": cookie de sesión (sin maxAge) que expira
                // al cerrar el navegador. Respetamos maxAge:0 (remociones).
                delete o.maxAge;
              }
              cookieStore.set(name, value, o);
            });
          } catch {
            // The `setAll` method can throw in middleware and server actions.
          }
        },
      },
    },
  );
}
