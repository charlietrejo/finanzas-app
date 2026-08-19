import Link from "next/link";
import { ArrowRight, Lock, Mail, UserRound } from "lucide-react";

// QA-41 — Registro server-first: formulario HTML nativo (sin hidratación).
// Render server-side; errores/éxito vía query params. Botón nativo con las
// mismas clases del variant "default" de ui/button (gradiente) para mantener
// el estándar visual sin depender de JS.
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; confirm?: string }>;
}) {
  const { error, confirm } = await searchParams;

  const submitClass =
    "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] hover:from-violet-700 hover:via-indigo-700 hover:to-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Registro</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Crea tu cuenta</h2>
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      {confirm && (
        <p role="status" className="text-sm text-emerald-600">
          Cuenta creada. Revisa tu correo para confirmar tu cuenta. Si no recibes
          el mensaje, revisa la carpeta de spam.
        </p>
      )}

      <form className="space-y-5" method="POST" action="/api/auth/register">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-700">
          <UserRound className="h-5 w-5" />
          <input
            type="text"
            name="fullName"
            autoComplete="name"
            className="w-full bg-transparent text-base placeholder:text-slate-400 outline-none"
            placeholder="Nombre completo"
          />
        </label>

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

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-700">
          <Lock className="h-5 w-5" />
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            className="w-full bg-transparent text-base placeholder:text-slate-400 outline-none"
            placeholder="Contraseña"
            required
            minLength={6}
          />
        </label>

        <button className={submitClass} type="submit">
          Crear cuenta
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      <p className="text-sm text-slate-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-slate-800">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
