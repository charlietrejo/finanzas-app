import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Invalidación de sesión en el servidor (patrón oficial Supabase + Next.js).
// El server client puede borrar las cookies de forma fiable y revocar la
// sesión (incluido el refresh token), a diferencia del signOut del cliente
// que en algunos entornos deja la cookie viva y el middleware la rehidrata.
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // Usa request.nextUrl.origin (host público del cliente); en el edge de
  // Netlify request.url es la URL interna del deploy (QA-39/QA-40).
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
}
