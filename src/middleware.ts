import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/manifest.webmanifest"];
const PROTECTED_PATHS = ["/dashboard", "/transactions", "/analytics", "/budgets", "/goals", "/accounts", "/categories", "/settings"];

// NOTA (QA-31): Se intentó generar un CSP dinámico con nonce reusando el nonce
// que Next.js 16.3.1 inyecta en los scripts inline de RSC. No es viable desde
// el middleware: Next 16.3.1 genera su PROPIO nonce para los scripts (ignora el
// header x-nonce y el CSP del request) y lo aplica en una etapa POSTERIOR al
// middleware; además, response.text()/response.body en el middleware entrega un
// body VACÍO (el HTML real se transmite después del pipeline del middleware).
// Por tanto no hay forma de sincronizar el CSP response con el nonce de los
// scripts sin leer el body final, lo cual no es posible aquí. El CSP dinámico
// quedó pendiente de una solución compatible (ver reporte QA-31).

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if (user && PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!user && PROTECTED_PATHS.some((item) => pathname === item || pathname.startsWith(`${item}/`))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export { proxy as middleware };

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)).*)"],
};
