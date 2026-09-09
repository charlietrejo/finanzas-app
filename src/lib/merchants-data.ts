import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Database, Merchant } from "@/types/database";

/**
 * `merchants` es un catálogo compartido y prácticamente estático (sección
 * 3.8): idéntico para todos los usuarios. Antes se re-consultaba completo
 * en cada carga de /transactions. Se cachea 1h con unstable_cache — usa un
 * cliente de Supabase sin cookies (no depende de la sesión de quien pida
 * la página) porque la política RLS de `merchants` permite lectura pública
 * (ver 014_performance_audit_fixes.sql).
 */
const getCachedMerchants = unstable_cache(
  async (): Promise<Merchant[]> => {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase.from("merchants").select("*").order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  ["merchants-catalog"],
  { revalidate: 3600 }
);

export async function getMerchants(): Promise<Merchant[]> {
  return getCachedMerchants();
}
