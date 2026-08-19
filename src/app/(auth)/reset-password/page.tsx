import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// QA-41 — Página de nueva contraseña (server-first, sin hidratación).
// Paso 1: el enlace de Supabase llega con ?code= (PKCE). Hacemos el exchange
//   server-side (exchangeCodeForSession) que escribe las cookies de sesión.
// Paso 2: si hay sesión válida, mostramos el formulario nativo de nueva
//   contraseña que postea a /api/auth/reset-password (updateUser).
// Si no hay code ni sesión => enlace inválido/expirado.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { code, error } = await searchParams;

  const submitClass =
    "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] hover:from-violet-700 hover:via-indigo-700 hover:to-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";

  let sessionReady = false;

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      sessionReady = true;
    }
  } else {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) sessionReady = true;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Recuperación</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          Nueva contraseña
        </h2>
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}

      {sessionReady ? (
        <form
          className="space-y-5"
          method="POST"
          action="/api/auth/reset-password"
        >
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-700">
            <Lock className="h-5 w-5" />
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              className="w-full bg-transparent text-base placeholder:text-slate-400 outline-none"
              placeholder="Nueva contraseña"
              required
              minLength={6}
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-700">
            <Lock className="h-5 w-5" />
            <input
              type="password"
              name="confirm"
              autoComplete="new-password"
              className="w-full bg-transparent text-base placeholder:text-slate-400 outline-none"
              placeholder="Confirmar contraseña"
              required
              minLength={6}
            />
          </label>

          <button className={submitClass} type="submit">
            Actualizar contraseña
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            El enlace de recuperación es inválido o ha expirado. Solicita uno
            nuevo.
          </p>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-slate-700 hover:text-slate-900"
          >
            Solicitar enlace de recuperación
          </Link>
        </div>
      )}
    </div>
  );
}
