import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// QA-41 — Registro server-side (sin dependencia de hidratación React/RSC).
// Reutiliza createSupabaseServerClient (oficial) para que las cookies de
// sesión se escriban con @supabase/ssr. Espejo del patrón de /api/auth/login.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();

  const redirectTo = (path: string, message?: string) => {
    // request.nextUrl.origin = host público del cliente (evita URL interna
    // del edge de Netlify, QA-39/QA-40).
    const url = new URL(path, request.nextUrl.origin);
    if (message) url.searchParams.set("error", message);
    return NextResponse.redirect(url, 303);
  };

  const redirectSuccess = (path: string, param?: string) => {
    const url = new URL(path, request.nextUrl.origin);
    if (param) url.searchParams.set(param, "1");
    return NextResponse.redirect(url, 303);
  };

  if (!email || !password) {
    return redirectTo("/register", "Completa tu correo electrónico y contraseña.");
  }
  if (password.length < 6) {
    return redirectTo("/register", "La contraseña debe tener al menos 6 caracteres.");
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
      emailRedirectTo: new URL("/login", request.nextUrl.origin).toString(),
    },
  });

  if (error) {
    return redirectTo("/register", error.message);
  }

  // Si Supabase devuelve sesión inmediata => no requiere confirmación de correo.
  if (data.session) {
    return redirectSuccess("/dashboard");
  }

  // Requiere confirmación por correo (configuración actual del proyecto).
  return redirectSuccess("/register", "confirm");
}
