import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Inicio de sesión</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">Accede a tu panel</h2>
      </div>

      <AuthForm mode="login" />

      <div className="flex items-center justify-between text-sm text-slate-500">
        <Link href="/forgot-password" className="font-medium text-slate-700 hover:text-slate-950">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link href="/register" className="font-medium text-slate-700 hover:text-slate-950">
          Crear cuenta
        </Link>
      </div>
    </div>
  );
}
