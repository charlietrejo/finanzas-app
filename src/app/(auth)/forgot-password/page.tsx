import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";

// QA-41 — Forgot-password server-first: formulario HTML nativo (sin
// hidratación). El éxito se muestra con mensaje genérico (anti-enumeración);
// errores técnicos vía query param. Botón nativo con clases gradiente.
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  const submitClass =
    "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] hover:from-violet-700 hover:via-indigo-700 hover:to-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Recuperación</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          Recupera tu acceso
        </h2>
      </div>

      <p className="text-sm leading-6 text-slate-600">
        Te enviaremos un enlace seguro para restablecer tu contraseña.
      </p>

      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className="text-sm text-emerald-600">
          Si el correo está registrado, recibirás instrucciones para restablecer
          tu contraseña.
        </p>
      )}

      <form className="space-y-5" method="POST" action="/api/auth/forgot-password">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-700">
          <Mail className="h-5 w-5" />
          <input
            type="email"
            name="email"
            autoComplete="email"
            className="w-full bg-transparent text-base placeholder:text-slate-400 outline-none"
            placeholder="Correo electrónico"
            required
          />
        </label>

        <button className={submitClass} type="submit">
          Enviar enlace
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <Link
        href="/login"
        className="text-sm font-medium text-slate-700 hover:text-slate-900"
      >
        Volver a iniciar sesión
      </Link>
    </div>
  );
}
