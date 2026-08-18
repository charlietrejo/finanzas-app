import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// QA-36 — Login server-side vía formulario HTML nativo (sin dependencia de
// hidratación React/RSC). Reutiliza el cliente Supabase server-side oficial del
// proyecto (createSupabaseServerClient) para que las cookies de sesión se
// escriban con el mecanismo @supabase/ssr ya usado en /auth/signout.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const redirectTo = (path: string, message?: string) => {
    // Usa request.nextUrl.origin (host público del cliente) en lugar de
    // request.url: en el edge de Netlify request.url es la URL interna del
    // deploy, lo que generaba un Location hacia el hostname interno (QA-39).
    const url = new URL(path, request.nextUrl.origin);
    if (message) url.searchParams.set("error", message);
    return NextResponse.redirect(url, 303);
  };

  if (!email || !password) {
    return redirectTo(
      "/login",
      "Completa tu correo electrónico y contraseña.",
    );
  }

  const supabase = await createSupabaseServerClient();

  // Si ya hay sesión, evitamos un signIn innecesario y vamos al panel.
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();
  if (existingUser) {
    return redirectTo("/dashboard");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return redirectTo("/login", error.message);
  }

  // Las cookies de sesión ya fueron escritas por @supabase/ssr en el
  // cookieStore de este Route Handler; se propagan en la respuesta.
  return redirectTo("/dashboard");
}
