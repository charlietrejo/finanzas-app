import Link from "next/link";

import Icon from "@/components/ui/icon-material";

import { AuthForm, LoginFormNative } from "@/components/auth/auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.10),_transparent_50%)] px-5 pb-10 pt-safe">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30">
            <Icon name="account_balance_wallet" className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Northstar Finance</h1>
          <p className="mt-1 text-sm text-slate-500">Gestiona tu dinero con claridad</p>
        </div>

        <div className="rounded-[32px] border border-slate-200/70 bg-white/85 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-900">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-slate-500">Accede a tu panel financiero</p>
          </div>

          <LoginFormNative serverError={error ?? null} />

          <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
            <Link
              href="/forgot-password"
              className="font-medium text-slate-700 hover:text-slate-900"
            >
              ¿Olvidaste tu contraseña?
            </Link>
            <Link
              href="/register"
              className="font-medium text-slate-700 hover:text-slate-900"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
