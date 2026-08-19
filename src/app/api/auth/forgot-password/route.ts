import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// QA-41 — Forgot-password server-side (sin hidratación). Envía el enlace de
// reset vía Supabase Auth. Mensaje GENÉRICO para no revelar si el correo está
// registrado (anti-enumeración). El resetTo apunta a /reset-password en el
// origen público (request.nextUrl.origin).
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();

  const redirectTo = (path: string, param?: string, value?: string) => {
    const url = new URL(path, request.nextUrl.origin);
    if (param) url.searchParams.set(param, value ?? "1");
    return NextResponse.redirect(url, 303);
  };

  // Siempre mensaje genérico, incluso con email vacío (no revelar nada).
  if (!email) {
    return redirectTo("/forgot-password", "sent");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL("/reset-password", request.nextUrl.origin).toString(),
  });

  // Por seguridad: en cualquier caso (éxito o email inexistente) mostramos el
  // mismo mensaje genérico. Solo un fallo de red Servicio se manifiesta igual.
  if (error) {
    return redirectTo("/forgot-password", "sent");
  }

  return redirectTo("/forgot-password", "sent");
}
