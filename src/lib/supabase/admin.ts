import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente con el service role key (bypassea RLS) — SOLO para procesos
 * server-to-server sin sesión de usuario (ej. la ruta del cron de Fase 8).
 * Nunca se usa `@supabase/ssr` aquí porque no hay cookies que leer: no es
 * una petición de un usuario autenticado, es el propio backend actuando
 * sobre todos los usuarios. `SUPABASE_SERVICE_ROLE_KEY` no lleva el prefijo
 * `NEXT_PUBLIC_`, así que Next.js nunca lo incluye en el bundle del cliente.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
