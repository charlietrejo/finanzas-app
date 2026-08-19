import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// QA-41 — Cambio de contraseña server-side (sin hidratación). Se invoca desde
// el formulario nativo de /reset-password una vez que la sesión fue establecida
// por el exchange del code (PKCE) en la página server. Usa updateUser.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const redirectToError = (message: string) => {
    const url = new URL("/reset-password", request.nextUrl.origin);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, 303);
  };

  if (!password || password.length < 6) {
    return redirectToError("La contraseña debe tener al menos 6 caracteres.");
  }
  if (password !== confirm) {
    return redirectToError("Las contraseñas no coinciden.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return redirectToError(error.message);
  }

  // Contraseña actualizada: enviamos al login con aviso.
  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set("reset", "1");
  return NextResponse.redirect(url, 303);
}
